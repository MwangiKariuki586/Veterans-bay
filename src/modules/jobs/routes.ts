import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import type { PageResult } from "../../platform/http/pagination";
import {
  parseJsonBody,
  parseQuery,
  parseWithSchema,
} from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { JobsRepository, type ProfessionalJobScope } from "./repository";
import {
  jobActionBodySchema,
  jobAssignmentBodySchema,
  jobChecklistBodySchema,
  jobCompletionBodySchema,
  jobEvidenceBodySchema,
  jobIdSchema,
  jobListQuerySchema,
  jobMessageBodySchema,
  jobUpdateBodySchema,
  jobVariationBodySchema,
  jobVariationResponseBodySchema,
  jobVariationSubmitBodySchema,
} from "./schemas";
import { JobsService } from "./service";
import type { JobDetail, JobSummary } from "./types";
import type { EngagementConversation } from "../conversations/types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new JobsService(
      new JobsRepository(client.db),
      new IdentityRepository(client.db),
    ),
  };
}

function id(value: string) {
  return parseWithSchema(jobIdSchema, value);
}

function authUserId(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account is required.");
  return account.authUserId;
}

function professionalSelection(context: {
  get(key: "workspaceSelection"):
    | {
        accountProfileId: string;
        workspace: {
          organisationId: string | null;
          membershipId: string | null;
          assignedJobsOnly: boolean;
        };
      }
    | undefined;
}): { actorAccountId: string; scope: ProfessionalJobScope } {
  const selection = context.get("workspaceSelection");
  if (
    !selection?.workspace.organisationId ||
    !selection.workspace.membershipId
  ) {
    throw new Error("Organisation workspace is required.");
  }
  return {
    actorAccountId: selection.accountProfileId,
    scope: {
      organisationId: selection.workspace.organisationId,
      membershipId: selection.workspace.membershipId,
      assignedJobsOnly: selection.workspace.assignedJobsOnly,
    },
  };
}

export function createJobRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const professionalRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.jobsView),
  ] as const;
  const professionalManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.jobsManage),
  ] as const;
  const assignmentManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.assignmentsManage),
  ] as const;

  routes.get("/v1/professional/jobs", ...professionalRead, async (context) => {
    const selection = professionalSelection(context);
    const query = parseQuery(jobListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listProfessional({
        scope: selection.scope,
        ...query,
      });
      return context.json<ApiSuccessBody<PageResult<JobSummary>>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/professional/jobs/from-booking/:bookingId",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createFromBooking({
          ...selection,
          bookingId: id(context.req.param("bookingId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/jobs/:jobId/conversation",
    ...professionalRead,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessionalConversation({
          ...selection,
          jobId: id(context.req.param("jobId")),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/conversation/messages",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobMessageBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.sendProfessionalMessage({
          ...selection,
          jobId: id(context.req.param("jobId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/conversation/read",
    ...professionalRead,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.markProfessionalConversationRead({
          ...selection,
          jobId: id(context.req.param("jobId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/jobs/:jobId",
    ...professionalRead,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessional(
          id(context.req.param("jobId")),
          selection.scope,
        );
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/assignments",
    ...assignmentManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobAssignmentBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.assign({
          ...selection,
          jobId: id(context.req.param("jobId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.delete(
    "/v1/professional/jobs/:jobId/assignments/:assignmentId",
    ...assignmentManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobActionBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.unassign({
          ...selection,
          jobId: id(context.req.param("jobId")),
          assignmentId: id(context.req.param("assignmentId")),
          lockVersion: values.lockVersion,
          reason: values.reason,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  for (const [path, action] of [
    ["check-in", "CHECK_IN"],
    ["start", "START"],
    ["hold", "HOLD"],
    ["resume", "RESUME"],
    ["ready", "READY"],
    ["cancel", "CANCEL"],
  ] as const) {
    routes.post(
      `/v1/professional/jobs/:jobId/${path}`,
      ...professionalManage,
      async (context) => {
        const selection = professionalSelection(context);
        const values = await parseJsonBody(
          jobActionBodySchema,
          context.req.raw,
        );
        const { client, service } = createService(
          context.get("environment").DATABASE_URL,
        );
        try {
          const data = await service.transition({
            ...selection,
            jobId: id(context.req.param("jobId")),
            action,
            lockVersion: values.lockVersion,
            reason: values.reason,
            correlationId: context.get("requestId"),
          });
          return context.json<ApiSuccessBody<JobDetail>>({
            data,
            requestId: context.get("requestId"),
          });
        } finally {
          await client.close();
        }
      },
    );
  }

  routes.put(
    "/v1/professional/jobs/:jobId/checklist/:checklistItemId",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobChecklistBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.setChecklist({
          ...selection,
          jobId: id(context.req.param("jobId")),
          checklistItemId: id(context.req.param("checklistItemId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/updates",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobUpdateBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.addUpdate({
          ...selection,
          jobId: id(context.req.param("jobId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/evidence",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobEvidenceBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.addEvidence({
          ...selection,
          jobId: id(context.req.param("jobId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/variations",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobVariationBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createVariation({
          ...selection,
          jobId: id(context.req.param("jobId")),
          ...values,
        });
        return context.json<ApiSuccessBody<JobDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/variations/:variationId/submit",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        jobVariationSubmitBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.submitVariation({
          ...selection,
          jobId: id(context.req.param("jobId")),
          variationId: id(context.req.param("variationId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/jobs/:jobId/variations/:variationId/withdraw",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.withdrawVariation({
          ...selection,
          jobId: id(context.req.param("jobId")),
          variationId: id(context.req.param("variationId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.use("/v1/client/jobs", requireSessionMiddleware);
  routes.use("/v1/client/jobs/*", requireSessionMiddleware);

  routes.get("/v1/client/jobs", async (context) => {
    const query = parseQuery(jobListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listClient({
        authUserId: authUserId(context),
        ...query,
      });
      return context.json<ApiSuccessBody<PageResult<JobSummary>>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/jobs/:jobId", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.getClient(
        authUserId(context),
        id(context.req.param("jobId")),
      );
      return context.json<ApiSuccessBody<JobDetail>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/jobs/:jobId/conversation", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.getClientConversation(
        authUserId(context),
        id(context.req.param("jobId")),
      );
      return context.json<ApiSuccessBody<EngagementConversation>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/client/jobs/:jobId/conversation/messages",
    async (context) => {
      const values = await parseJsonBody(
        jobMessageBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.sendClientMessage({
          authUserId: authUserId(context),
          jobId: id(context.req.param("jobId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/jobs/:jobId/conversation/read",
    async (context) => {
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.markClientConversationRead({
          authUserId: authUserId(context),
          jobId: id(context.req.param("jobId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/jobs/:jobId/variations/:variationId/respond",
    async (context) => {
      const values = await parseJsonBody(
        jobVariationResponseBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.respondVariation({
          authUserId: authUserId(context),
          jobId: id(context.req.param("jobId")),
          variationId: id(context.req.param("variationId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/jobs/:jobId/completion-response",
    async (context) => {
      const values = await parseJsonBody(
        jobCompletionBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.respondCompletion({
          authUserId: authUserId(context),
          jobId: id(context.req.param("jobId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<JobDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}
