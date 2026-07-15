import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { ChatConversation } from "../models/ChatConversation.js"
import { ChatMessage } from "../models/ChatMessage.js"
import { assertTeacherParentLink } from "../utils/chatAccess.js"

// Track active calls and media shares
const activeCalls = new Map() // userId -> { callId, otherId, status }
const mediaShares = new Map() // userId -> { mediaId, otherId, type, status }

function getUserId(socket) {
  const user = socket.user || {}
  return user.id || user._id || user.userId || "unknown"
}

function getUserRole(socket) {
  const user = socket.user || {}
  // expected: "teacher" | "parent" | "admin" | "superAdmin" ...
  return user.role || "unknown"
}

function isTeacherParentPair(roleA, roleB) {
  const a = String(roleA || "").toLowerCase()
  const b = String(roleB || "").toLowerCase()
  return (a === "teacher" && b === "parent") || (a === "parent" && b === "teacher")
}

function makeConvKey(aId, aRole, bId, bRole) {
  const A = `${String(aRole)}:${String(aId)}`
  const B = `${String(bRole)}:${String(bId)}`
  return [A, B].sort().join("|")
}

export default function initChat(io) {
  try {
    if (io && io.engine) {
      io.engine.on &&
        io.engine.on("connection_error", (err) => {
          console.error("[socket.io] engine connection_error:", err && err.message, err)
        })
    }
  } catch (e) {}

  // Socket auth middleware: expects token in socket.handshake.auth.token
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token

      if (!token) {
        const header = socket.handshake.headers && socket.handshake.headers.authorization

        if (header && header.startsWith("Bearer ")) {
          socket.user = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET)
          return next()
        }

        return next(new Error("Authentication error: No token"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      socket.user = decoded
      return next()
    } catch (err) {
      console.error("[socket.io] auth error:", err && err.message, err)
      return next(new Error("Authentication error: Invalid token"))
    }
  })

  io.on("connection", (socket) => {
    socket.on("error", (err) => {
      console.error("[socket.io] socket error for", socket.id, err && err.message, err)
    })

    const userId = String(getUserId(socket))
    const userRole = String(getUserRole(socket)).toLowerCase()

    console.log("[socket.io] connected", socket.id, "user:", userId, "role:", userRole)

    socket.join(`user:${userId}`)

    // ========== CHAT (Teacher <-> Parent) ==========

    // Join a chat room between current user and other user
    // payload: { otherId, otherRole }
    // NOTE: otherRole optional for backward compatibility, but teacher-parent enforced when provided
    socket.on("joinChat", (payload) => {
      try {
        const otherId = payload && payload.otherId
        const otherRole = payload && payload.otherRole

        console.log(`[socket] joinChat request from ${userId} -> other:${otherId} role:${otherRole}`)

        if (!otherId) return

        if (otherRole && !isTeacherParentPair(userRole, otherRole)) {
          socket.emit("chatError", {
            message: "Only Teacher and Parent can chat with each other",
          })
          return
        }

        const roomKey = [String(userId), String(otherId)].sort().join(":")
        const room = `chat:${roomKey}`

        socket.join(room)
        console.log(`[socket] ${socket.id} joined room ${room}`)
        socket.emit("joined", { room })
      } catch (e) {
        console.error("joinChat handler error:", e && e.message, e)
      }
    })

    // Send message
    // payload: { to, toRole, text, meta }
    // NOTE: toRole optional for backward compatibility, but teacher-parent enforced when provided
    socket.on("message", async (payload, ack) => {
      try {
        console.log(`[socket] incoming message handler from ${userId} payload:`, payload)
        if (!payload || !payload.to || !payload.text) {
          if (typeof ack === "function") ack({ ok: false, error: "invalid_payload" })
          return
        }

        const to = String(payload.to)
        let toRole = payload.toRole ? String(payload.toRole).toLowerCase() : null

        if (!toRole) {
          toRole = userRole === "teacher" ? "parent" : "teacher"
        }

        if (!isTeacherParentPair(userRole, toRole)) {
          socket.emit("chatError", {
            message: "Only Teacher and Parent can chat with each other",
          })
          if (typeof ack === "function") ack({ ok: false, error: "not_allowed" })
          return
        }

        const roomKey = [String(userId), to].sort().join(":")
        const message = {
          from: String(userId),
          fromRole: userRole,
          to,
          toRole: toRole,
          text: String(payload.text),
          meta: payload.meta || {},
          createdAt: new Date().toISOString(),
        }

        console.log(`[socket] emitting message to chat:${roomKey} and user:${to}`)

        // Emit to the chat room (both participants)
        io.to(`chat:${roomKey}`).emit("message", message)

        // Also emit to personal room of recipient for convenience
        io.to(`user:${to}`).emit("message", message)

        // Acknowledge receipt to sender (quick ack)
        if (typeof ack === "function") {
          try {
            ack({ ok: true })
          } catch (ackErr) {
            // ignore
          }
        }

        // Persist conversation and message to DB
        try {
          const fromId = new mongoose.Types.ObjectId(message.from)
          const toId = new mongoose.Types.ObjectId(message.to)

          // If it's a teacher-parent chat, assert link exists
          if (isTeacherParentPair(message.fromRole, toRole)) {
            const teacherId = message.fromRole === "teacher" ? fromId : toId
            const parentId = message.fromRole === "parent" ? fromId : toId
            console.log(`[chat] checking access teacher:${teacherId} parent:${parentId}`)
            const access = await assertTeacherParentLink({
              teacherId,
              parentId,
            })
            console.log(`[chat] access result:`, access)
            if (!access.ok) {
              socket.emit("chatError", {
                message: `Chat not allowed: ${access.reason}`,
              })
              if (typeof ack === "function") ack({ ok: false, error: "access_denied" })
              return
            }
          }

          const convKey = makeConvKey(fromId, message.fromRole, toId, toRole)
          const participants = [
            { userId: fromId, role: message.fromRole },
            { userId: toId, role: toRole },
          ]

          console.log(`[chat] upserting conversation with key: ${convKey}`)
          const conv = await ChatConversation.findOneAndUpdate(
            { key: convKey },
            {
              $setOnInsert: { key: convKey, participants },
              $set: {
                lastMessageText: message.text,
                lastMessageAt: new Date(),
              },
            },
            { upsert: true, new: true },
          )
          console.log(`[chat] conversation upserted:`, conv && conv._id)

          const chatMsg = new ChatMessage({
            conversationId: conv._id,
            from: { userId: fromId, role: message.fromRole },
            to: { userId: toId, role: toRole },
            text: message.text,
          })

          const saved = await chatMsg.save()
          console.log(`[chat] message saved:`, saved && saved._id)
        } catch (dbErr) {
          console.error("[chat] DB save error:", dbErr && dbErr.message, dbErr)
          if (typeof ack === "function") ack({ ok: false, error: "database_error" })
        }
      } catch (e) {
        console.error("message handler error:", e && e.message, e)
        if (typeof ack === "function") ack({ ok: false, error: "handler_error" })
      }
    })

    // Typing indicator (Teacher/Parent)
    // payload: { to, isTyping }
    socket.on("typing", (payload) => {
      try {
        const { to, isTyping } = payload || {}
        if (to === undefined || isTyping === undefined) return

        io.to(`user:${to}`).emit("userTyping", {
          from: String(userId),
          fromRole: userRole,
          isTyping: !!isTyping,
        })
      } catch (e) {
        // silent
      }
    })

    // ========== VIDEO CALL EVENTS ==========

    // Initiate a video call
    // payload: { to, callId }
    socket.on("initiateCall", (payload) => {
      try {
        const { to, callId } = payload || {}
        if (!to || !callId) return

        const callData = {
          callId,
          from: String(userId),
          to: String(to),
          status: "ringing",
          initiatedAt: new Date().toISOString(),
        }

        activeCalls.set(userId, { callId, otherId: to, status: "initiating" })

        // Send call invitation to recipient
        io.to(`user:${to}`).emit("callIncoming", callData)
        console.log(`[call] ${userId} initiated call to ${to} with ID ${callId}`)
      } catch (e) {
        console.error("[call] initiateCall error:", e)
      }
    })

    // Accept a video call
    // payload: { callId, from }
    socket.on("acceptCall", (payload) => {
      try {
        const { callId, from } = payload || {}
        if (!callId || !from) return

        activeCalls.set(userId, { callId, otherId: from, status: "accepted" })

        io.to(`user:${from}`).emit("callAccepted", {
          callId,
          acceptedBy: String(userId),
          acceptedAt: new Date().toISOString(),
        })

        console.log(`[call] ${userId} accepted call ${callId} from ${from}`)
      } catch (e) {
        console.error("[call] acceptCall error:", e)
      }
    })

    // Reject a video call
    // payload: { callId, from }
    socket.on("rejectCall", (payload) => {
      try {
        const { callId, from } = payload || {}
        if (!callId || !from) return

        activeCalls.delete(userId)

        io.to(`user:${from}`).emit("callRejected", {
          callId,
          rejectedBy: String(userId),
          rejectedAt: new Date().toISOString(),
        })

        console.log(`[call] ${userId} rejected call ${callId} from ${from}`)
      } catch (e) {
        console.error("[call] rejectCall error:", e)
      }
    })

    // End a video call
    // payload: { to, callId }
    socket.on("endCall", (payload) => {
      try {
        const { to, callId } = payload || {}
        if (!to || !callId) return

        activeCalls.delete(userId)

        io.to(`user:${to}`).emit("callEnded", {
          callId,
          endedBy: String(userId),
          endedAt: new Date().toISOString(),
        })

        console.log(`[call] ${userId} ended call ${callId} with ${to}`)
      } catch (e) {
        console.error("[call] endCall error:", e)
      }
    })

    // WebRTC ICE candidate
    // payload: { to, candidate, callId }
    socket.on("iceCandidate", (payload) => {
      try {
        const { to, candidate, callId } = payload || {}
        if (!to || !candidate) return

        io.to(`user:${to}`).emit("iceCandidate", {
          from: String(userId),
          candidate,
          callId,
        })
      } catch (e) {
        console.error("[call] iceCandidate error:", e)
      }
    })

    // WebRTC offer
    // payload: { to, offer, callId }
    socket.on("offer", (payload) => {
      try {
        const { to, offer, callId } = payload || {}
        if (!to || !offer) return

        io.to(`user:${to}`).emit("offer", {
          from: String(userId),
          offer,
          callId,
        })
      } catch (e) {
        console.error("[call] offer error:", e)
      }
    })

    // WebRTC answer
    // payload: { to, answer, callId }
    socket.on("answer", (payload) => {
      try {
        const { to, answer, callId } = payload || {}
        if (!to || !answer) return

        io.to(`user:${to}`).emit("answer", {
          from: String(userId),
          answer,
          callId,
        })
      } catch (e) {
        console.error("[call] answer error:", e)
      }
    })

    // ========== MEDIA SHARE EVENTS ==========

    // Start sharing media (screen, camera, file)
    // payload: { to, mediaId, type, metadata }
    socket.on("startMediaShare", (payload) => {
      try {
        const { to, mediaId, type, metadata } = payload || {}
        if (!to || !mediaId || !type) return

        const shareData = {
          mediaId,
          from: String(userId),
          to: String(to),
          type, // 'screen', 'camera', 'file'
          metadata: metadata || {},
          startedAt: new Date().toISOString(),
          status: "active",
        }

        mediaShares.set(userId, {
          mediaId,
          otherId: to,
          type,
          status: "sharing",
        })

        io.to(`user:${to}`).emit("mediaShareStarted", shareData)
        console.log(`[media] ${userId} started sharing ${type} (${mediaId}) with ${to}`)
      } catch (e) {
        console.error("[media] startMediaShare error:", e)
      }
    })

    // Stream media data (chunks)
    // payload: { to, mediaId, chunk, chunkIndex, totalChunks }
    socket.on("mediaStreamChunk", (payload) => {
      try {
        const { to, mediaId, chunk, chunkIndex, totalChunks } = payload || {}
        if (!to || !mediaId || !chunk) return

        io.to(`user:${to}`).emit("mediaStreamChunk", {
          from: String(userId),
          mediaId,
          chunk,
          chunkIndex,
          totalChunks,
        })
      } catch (e) {
        console.error("[media] mediaStreamChunk error:", e)
      }
    })

    // Stop sharing media
    // payload: { to, mediaId }
    socket.on("stopMediaShare", (payload) => {
      try {
        const { to, mediaId } = payload || {}
        if (!to || !mediaId) return

        mediaShares.delete(userId)

        io.to(`user:${to}`).emit("mediaShareStopped", {
          from: String(userId),
          mediaId,
          stoppedAt: new Date().toISOString(),
        })

        console.log(`[media] ${userId} stopped sharing media ${mediaId}`)
      } catch (e) {
        console.error("[media] stopMediaShare error:", e)
      }
    })

    // Upload/share file metadata
    // payload: { to, fileId, fileName, fileSize, mimeType, fileData }
    socket.on("shareFile", (payload) => {
      try {
        const { to, fileId, fileName, fileSize, mimeType, fileData } = payload || {}
        if (!to || !fileId || !fileName) return

        const fileShare = {
          fileId,
          from: String(userId),
          to: String(to),
          fileName,
          fileSize,
          mimeType,
          sharedAt: new Date().toISOString(),
          fileData: fileData || null, // Can be null if sent in chunks
        }

        io.to(`user:${to}`).emit("fileShared", fileShare)
        console.log(`[file] ${userId} shared file ${fileName} (${fileId}) with ${to}`)
      } catch (e) {
        console.error("[file] shareFile error:", e)
      }
    })

    socket.on("disconnect", () => {
      // Clean up active calls and media shares
      activeCalls.delete(userId)
      mediaShares.delete(userId)
      console.log(`[socket.io] disconnected ${socket.id} (user: ${userId})`)
    })
  })
}
