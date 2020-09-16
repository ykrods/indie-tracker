import { writable } from "svelte/store";

export const db = writable(null);

export const project = writable({ repo_name: "---" });

export const selectedStatuses = writable(["OPEN"]);

function convert(data) {
  const dateFields = ["created_at", "updated_at"];
  for (const field of dateFields) {
    if (data[field] === undefined) {
      continue;
    }
    try {
      const d = new Date(data[field]);
      data[field] = d === NaN ? null : d;
    } catch (e) {
      data[field] = null;
    }
  }
  return data;
}

export const socket = (() => {
  const { subscribe, set } = writable(null);

  let ws;

  return {
    subscribe,
    send(message) {
      ws.send(JSON.stringify(message));
    },
    open(project, db) {
      const protocol = location.protocol == "http:" ? "ws:" : "wss:";
      ws = new WebSocket(
        `${protocol}//${location.host}/ws?name=${project.name}`
      );
      // TODO: retry
      ws.onopen = async (event) => {
        const config = await db.configs.get("commit");
        const commit = (config ? config.value : null) || null;
        const msg = { type: "sync", commit };
        ws.send(JSON.stringify(msg));
      };

      ws.onclose = (event) => {
        // console.log(event);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "issue":
            db.issues.put(convert(msg.data));
            break;
          case "issue_deleted":
            db.issues.delete(msg.id);
            break;
        }
        if (msg.commit) {
          db.configs.put({ id: "commit", value: msg.commit });
        }
        // publish after update db
        set(msg);
      };
    },
  };
})();
