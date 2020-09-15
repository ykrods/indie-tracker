<!--
     IssueView: view ensured issue exists
-->
<script>
  import { push } from 'svelte-spa-history-router';
  import { Button, Menu, Menuitem } from 'svelte-mui';

  import { updateIssue, deleteIssue } from '../../api';

  import MenuButton from '../../common/MenuButton.svelte'
  import DeleteConfirmationDialog from '../../common/DeleteConfirmationDialog.svelte';
  import RstViewer from '../../common/RstViewer.svelte';
  import IssueForm from '../../common/IssueForm.svelte';
  import Comment from './Comment.svelte';
  import CommentForm from './CommentForm.svelte';

  export let issue;

  let editing = false;

  let showDeleteConfirmation = false;

  function onEditMenuPushed() {
    editing = true;
  }

  async function onIssueSave(event) {
    try {
      await updateIssue(issue.id, event.detail);
      editing = false;
    } catch (error) {
      console.error(error);
    }
  }

  function onIssueCancel() {
    editing = false;
  }
  function onDeleteMenuPushed() {
    showDeleteConfirmation = true;
  }
  async function doDelete() {
    await deleteIssue(issue.id);
    push(`/issues`);
  }
</script>

<div class="issue-view card">
  {#if !editing }
    <div class="heading">
      <div class="heading-id">[{issue.shorten_id}]</div>
      <h1>{issue.title}</h1>
      <Menu origin="top right">
        <div slot="activator">
          <MenuButton />
        </div>
        <Menuitem on:click={onEditMenuPushed}>Edit</Menuitem>
        <Menuitem style="color: var(--danger);" on:click={onDeleteMenuPushed}>Delete</Menuitem>
      </Menu>
    </div>
    <div class="summary">
      <table>
        <tr>
          <th>status:</th>
          <td>{issue.status_disp}</td>
        </tr>
      </table>
      <table>
        <tr>
          <th>created at:</th>
          <td>{issue.createdAt}</td>
        </tr>
        <tr>
          <th>updated at:</th>
          <td>{issue.updatedAt}</td>
        </tr>
      </table>
    </div>
    {#if typeof issue.body === 'string' && issue.body !== ''}
      <div class="issue-body">
        <RstViewer rst={issue.body} />
      </div>
    {/if}
  {:else}
    <IssueForm title={issue.title} status={issue.status} body={issue.body}
               on:save={onIssueSave}
               on:cancel={onIssueCancel}/>
  {/if}
  {#each issue.comments as comment}
  <Comment issueId={issue.id} {comment}/>
  {/each}

  {#if !editing}
  <div class="form-container">
    <h2>New comment</h2>
    <CommentForm issueId={issue.id}/>
  </div>
  {/if}

  <DeleteConfirmationDialog
    bind:visible={showDeleteConfirmation}
    message="Delete the issue '{issue ? issue.title: ''}' ?"
    on:do-delete={doDelete}
  />
</div>

<style>
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .heading-id {
    font-size: 1em;
    color: #888;
    margin-right: 5px;
  }
  .summary {
    margin-top: 10px;
    display: flex;
    align-items: start;
    justify-content: space-evenly;
    color: #888;
  }

  .issue-body {
    margin-top: 10px;
    border-top: 1px dashed #989898;
  }
  .form-container {
    border-top: 1px dashed #989898;
  }
</style>
