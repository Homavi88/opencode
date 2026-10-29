import { Rpc } from "@opencode/plugin/rpc"

const snapshotSchema = {
  type: "object",
  properties: {
    used: { type: "number" },
    limit: { type: "number" },
    remaining: { type: "number" },
    percent: { type: "number" },
    sessionUsed: { type: "number" },
    windowHours: { type: "number" },
    windowMs: { type: "number" },
    updatedAt: { type: "number" },
  },
  required: [
    "used",
    "limit",
    "remaining",
    "percent",
    "sessionUsed",
    "windowHours",
    "windowMs",
    "updatedAt",
  ],
  additionalProperties: false,
} as const

export const TokenQuota = Rpc.define({
  id: "token-quota",
  methods: {
    get: {
      input: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
        },
        additionalProperties: false,
      },
      output: snapshotSchema,
    },
  },
  events: {
    updated: {
      schema: {
        type: "object",
        properties: {
          snapshot: snapshotSchema,
          sessionID: { type: "string" },
        },
        required: ["snapshot"],
        additionalProperties: false,
      },
    },
  },
})
