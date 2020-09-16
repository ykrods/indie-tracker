/**
 * api.js
 */
const client = {
  /**
   * fetch options for POST or PUT
   */
  _options(method, data) {
    return {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
  },

  async get(resource) {
    const res = await fetch(resource, { method: "GET" });
    const res_data = await res.json();

    if (res.ok) {
      return res_data;
    } else if (res.status === 404) {
      return null;
    }
    throw new Error(res_data);
  },
  async post(resource, data) {
    const res = await fetch(resource, this._options("POST", data));
    const res_data = await res.json();

    if (res.ok) {
      return res_data;
    }
    throw new Error(res.error);
  },
  async put(resource, data) {
    const res = await fetch(resource, this._options("PUT", data));
    const res_data = await res.json();

    if (res.ok) {
      return res_data;
    }
    throw new Error(res.error);
  },
  async delete(resource) {
    const res = await fetch(resource, { method: "DELETE" });

    if (res.status === 204) {
      return;
    } else if (res.ok) {
      const res_data = await res.json();
      return res_data;
    }
    throw new Error(res.error);
  },
};

export async function getProject() {
  return client.get("/api/project");
}

export async function getUserIdentity() {
  const identity = await client.get("/api/user_identity");
  return identity.user_identity;
}

export async function addIssue(issue) {
  return client.post(`/api/issues`, issue);
}
export async function updateIssue(issueId, issue) {
  return client.put(`/api/issues/${issueId}`, issue);
}

export async function deleteIssue(issueId) {
  return client.delete(`/api/issues/${issueId}`);
}

export async function addIssueComment(issueId, comment) {
  return client.post(`/api/issues/${issueId}/comments`, comment);
}

export async function updateIssueComment(issueId, commentId, comment) {
  return client.put(`/api/issues/${issueId}/comments/${commentId}`, comment);
}

export async function deleteIssueComment(issueId, commentId) {
  return client.delete(`/api/issues/${issueId}/comments/${commentId}`);
}

export async function getWikiPage(pageId) {
  const ret = await client.get(`/api/wiki/${pageId}`);

  // replace null to '' for svelte spread props
  ret.body = ret.body || "";
  return ret;
}

export async function putWikiPage(pageId, wikiPage) {
  return client.put(`/api/wiki/${pageId}`, wikiPage);
}

export async function deleteWikiPage(pageId) {
  const ret = await client.delete(`/api/wiki/${pageId}`);

  // replace null to '' for svelte spread props
  ret.body = "";
  return ret;
}

export async function getHTML(rst) {
  const data = await client.post(`/api/preview`, { rst });
  return data.html;
}
