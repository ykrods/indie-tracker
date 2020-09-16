<script>
  import { Button, Menu, Menuitem } from 'svelte-mui';

  import { deleteIssueComment } from '../../api';
  import MenuButton from '../../common/MenuButton.svelte'
  import RstViewer from '../../common/RstViewer.svelte';
  import CommentForm from './CommentForm.svelte';
  import DeleteConfirmationDialog from '../../common/DeleteConfirmationDialog.svelte';

  export let issueId;
  export let comment;

  let editing = false;
  let showDeleteConfirmation = false;

  function onDeleteMenuPushed() {
    showDeleteConfirmation = true;
  }

  function onCommentSaved() {
    editing = false;
  }

  async function doDelete() {
    await deleteIssueComment(issueId, comment.id);
  }

</script>
<div class="comment">
  {#if !editing}
    <div class="flex-align-top">
      <RstViewer rst={comment.body}/>
      <Menu origin="top right">
        <div slot="activator">
          <MenuButton />
        </div>
        <Menuitem on:click={() => { editing = true; }}>Edit</Menuitem>
        <Menuitem style="color: var(--danger);" on:click={onDeleteMenuPushed}>Delete</Menuitem>
      </Menu>
    </div>
  {:else}
    <CommentForm {issueId} {...comment}
      on:saved={onCommentSaved}
      on:canceled={() => { editing = false; }}/>
  {/if}

  <DeleteConfirmationDialog
    bind:visible={showDeleteConfirmation}
    message="Delete the comment ?"
    on:do-delete={doDelete}
  />
</div>

<style>
  .comment {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #989898;
  }
</style>
