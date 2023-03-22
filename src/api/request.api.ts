import fetch from "node-fetch";

export type METHOD = "GET" | "POST";

const API_ENDPOINT = process.env.API_ENDPOINT as string;

export const makeRequest = async (
  method: METHOD,
  path: string,
  body?: any
): Promise<any> => {
  if (method === "GET") {
    return await (await fetch(path, { method })).json();
  } else {
    return await (
      await fetch(path, {
        method,
        body: JSON.stringify(body),
      })
    ).json();
  }
};

export const get = async (path: string, url?: string): Promise<any> => {
  if (url) {
    return await makeRequest("GET", `${url}/${path}`);
  } else {
    return await makeRequest("GET", `${API_ENDPOINT}/${path}`);
  }
};

export const post = async (
  path: string,
  body: any,
  url?: string
): Promise<any> => {
  if (url) {
    return await makeRequest("POST", `${url}/${path}`, body);
  } else {
    return await makeRequest("POST", `${API_ENDPOINT}/${path}`, body);
  }
};
