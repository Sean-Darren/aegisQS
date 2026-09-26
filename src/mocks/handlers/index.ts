import { http, HttpResponse } from "msw";
import { mockUser } from "../fixtures/users";
export const handlers = [
  http.get("*/api/v1/me", () => HttpResponse.json(mockUser)),
];
