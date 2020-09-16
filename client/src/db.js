import Dexie from "dexie";

export function projectDB(project) {
  const db = new Dexie(`indie-tracker-${project.name}`);
  db.version(1).stores({
    issues: "id, title, status, created_at, updated_at",
  });
  db.version(2).stores({ configs: "id" });
  return db;
}

export const ISSUE_STATUSES = {
  OPEN: "Open",
  PENDING: "Pending",
  DECLINED: "Declined",
  CLOSED: "Closed",
};

function format_date(date, time = true) {
  if (!date) return "-";
  let options = {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  };

  if (time) {
    options = Object.assign(options, {
      hour12: false,
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return new Intl.DateTimeFormat("default", options).format(date);
}

export class Issue {
  get shorten_id() {
    return this.id.substring(0, 5);
  }
  get status_disp() {
    return ISSUE_STATUSES[this.status];
  }
  get createdDate() {
    return format_date(this.created_at, false);
  }
  get createdAt() {
    return format_date(this.created_at);
  }
  get updatedDate() {
    return format_date(this.updated_at, false);
  }
  get updatedAt() {
    return format_date(this.updated_at);
  }
}
