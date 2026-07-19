import type { ValidationIssue } from "../errors/app-error";

export interface ApiSuccessBody<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    issues?: ValidationIssue[];
    message: string;
  };
  requestId: string;
}
