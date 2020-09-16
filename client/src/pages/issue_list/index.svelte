<script>
  import { onMount } from 'svelte';
  import { Button, Checkbox } from 'svelte-mui';
  import { push, link } from 'svelte-spa-history-router';

  import AddButton from '../../common/AddButton.svelte';
  import { ISSUE_STATUSES, Issue } from '../../db';
  import { project, db, selectedStatuses} from '../../stores';

  let issuesPromise = Promise.resolve([]);

  $: if ($project) {
    window.document.title = `Issues @ ${$project.name} - Indie Tracker`;
  }

  $: if ($db && $selectedStatuses ) {
    $db.issues.mapToClass(Issue);
    issuesPromise = $db.issues.where(
      'status'
    ).anyOf(
      $selectedStatuses
    ).reverse().sortBy('_', (ary) => {
      return ary.sort((a, b) => {
        const i = new Date(1970, 1, 1);
        return  ((a.updated_at || i) < (b.updated_at || i));
      });
    });
  }

</script>

<div class="issue-list card">
  <div class="flex-align-top">
    <h1>Issues</h1>
    <AddButton on:click={() => push('/issues/new') } />
  </div>

  <fieldset>
    <legend>filters</legend>
    <div class="filter-status-row">
      <div>Status:</div>
      {#each Object.keys(ISSUE_STATUSES) as status }
      <Checkbox bind:group={$selectedStatuses} value={status}>
        <span>{ISSUE_STATUSES[status]}</span>
      </Checkbox>
      {/each}
    </div>
  </fieldset>

  <table class="issue-table">
    <tr>
      <th style="width: 8%">id</th>
      <th style="width: 47%">title</th>
      <th style="width: 15%;" class="prop">status</th>
      <th style="width: 15%;" class="prop">created at</th>
      <th style="width: 15%;" class="prop">updated at</th>
    </tr>
    {#await issuesPromise then issues }
    {#each issues as issue }
    <tr>
      <!-- svelte-ignore a11y-missing-attribute -->
      <td><a class="issue-link" use:link href={`/issues/${issue.id}`}>{issue.shorten_id}</a></td>
      <!-- svelte-ignore a11y-missing-attribute -->
      <td><a class="issue-link" use:link href={`/issues/${issue.id}`}>{issue.title}</a></td>
      <td class="prop prop-value">{issue.status_disp}</td>
      <td class="prop prop-value">{issue.createdDate}</td>
      <td class="prop prop-value">{issue.updatedDate}</td>
    </tr>
    {/each}
    {/await}
  </table>
</div>

<style>
  .prop {
    text-align: right;
  }
  .prop-value {
    color: #777;
  }

  .issue-list {
    padding: 10px;
  }
  .filter-status-row {
    display: flex;
    align-items: center;
  }
  .issue-table {
    margin: 20px 0 10px 0;
    width: 100%;
    font-size: 0.9em;
  }
  .issue-table th, .issue-table td {
    padding: 3px 0;
    border-bottom: 1px solid #ddd;
  }

  .issue-link {
    text-decoration: none;
    color: #557;
  }
  .issue-link:hover {
    color: var(--accent);
  }
</style>
