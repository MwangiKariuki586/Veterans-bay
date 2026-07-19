import { z } from "zod";

import { ValidationError, type ValidationIssue } from "../errors/app-error";

function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.length > 0 ? issue.path.join(".") : "request",
  }));
}

export function parseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(toValidationIssues(result.error), result.error);
  }

  return result.data;
}

export function parseQuery<TSchema extends z.ZodType>(
  schema: TSchema,
  url: string,
): z.output<TSchema> {
  return parseWithSchema(
    schema,
    Object.fromEntries(new URL(url).searchParams.entries()),
  );
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  schema: TSchema,
  request: Request,
): Promise<z.output<TSchema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    throw new ValidationError(
      [{ code: "invalid_json", path: "request" }],
      error,
    );
  }

  return parseWithSchema(schema, body);
}
