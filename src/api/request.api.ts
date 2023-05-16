import * as dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.API_ENDPOINT;

export const RELAYER_URL = process.env.REACT_APP_RELAYER_ENDPOINT as string;

class HttpError {
  constructor(public response: Response) {}
}

export function post<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  return makeRequest("POST", path, data);
}

export function postQuickNode<T = any>(data: Record<string, any>): Promise<T> {
  return makeRequest("POST", undefined, data, true);
}

export function put<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  return makeRequest("PUT", path, data);
}

export function patch<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  return makeRequest("PATCH", path, data);
}

export function deleteReq<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  return makeRequest("DELETE", path, data);
}

export function get<T = any>(path: string): Promise<T> {
  return makeRequest("GET", path);
}

type HttpMethod = "POST" | "GET" | "PUT" | "PATCH" | "DELETE";

export async function makeRequest(
  method: HttpMethod,
  path?: string,
  data?: Record<string, any>,
  quickNode?: boolean,
  customBaseUrl?: string
) {
  let response;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json, */*",
  };

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (data) {
    requestInit.body = JSON.stringify(data);
  }

  response = await fetch(`${customBaseUrl ?? BASE_URL}${path}`, requestInit);

  if (method === "DELETE") {
    return response;
  }
  return response.json();
}
