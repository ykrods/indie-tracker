<script>
  import { routeParams } from 'svelte-spa-history-router';

  import { Issue } from '../../db';
  import { db, socket, project } from '../../stores';

  import IssueView from './IssueView.svelte';

  let issue = null;

  $: issueId = $routeParams.issueId;

  $: if ($db && issueId) {
    refresh();
  }

  $: if ($socket && $socket.type === 'issue' && $socket.data.id === issueId) {
    refresh();
  }

  async function refresh() {
    $db.issues.mapToClass(Issue);
    issue = await $db.issues.get(issueId);

    const titleTail = `@ ${$project.name} - Indie Tracker`;
    if (issue) {
      window.document.title = `[${issue.shorten_id}] ${issue.title} ${titleTail}`;
    } else {
      window.document.title = `Unknown issue ${titleTail}`;
    }
  }
</script>

{#if issue}
  <IssueView {issue}/>
{:else}
  <div class="card">
    <h1>Unkown Issue</h1>
    <p>Issue:{issueId} does not exist.</p>
  </div>
{/if}
