import IssueList from "./pages/issue_list/index.svelte";
import IssueView from "./pages/issue_view/index.svelte";
import IssueEdit from "./pages/issue_edit/index.svelte";
import NotFound from "./pages/not_found/index.svelte";

import Wiki from "./pages/wiki/index.svelte";

export default [
  { path: "/", component: IssueList },
  { path: "/issues", component: IssueList },
  { path: "/issues/new", component: IssueEdit },
  { path: "/issues/(?<issueId>[0-9a-f-]+)", component: IssueView },
  { path: "/wiki/(?<pageId>.*)", component: Wiki },
  { path: ".*", component: NotFound },
];
