<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, Menu, Menuitem } from 'svelte-mui';
  import { routeParams, push } from 'svelte-spa-history-router';

  import { getWikiPage, deleteWikiPage } from '../../api';
  import MenuButton from '../../common/MenuButton.svelte';
  import RstViewer from '../../common/RstViewer.svelte';
  import DeleteConfirmationDialog from '../../common/DeleteConfirmationDialog.svelte';

  import WikiPageForm from './WikiPageForm.svelte';
  import BreadCrumb from './BreadCrumb.svelte';

  let editing = false;
  let wikiPage = null;
  let showDeleteConfirmation = false;

  $: refreshPromise = refresh($routeParams.pageId);

  async function refresh(pageId) {
    editing = false;
    wikiPage = await getWikiPage(pageId);
  }

  function onEditPushed() {
    editing = true;
  }
  function onSaved(event) {
    editing = false;
    wikiPage = event.detail;
  }
  function onEditingCanceled() {
    editing = false;
  }
  function onDeletePushed() {
    showDeleteConfirmation = true;
  }
  async function doDelete() {
    wikiPage = await deleteWikiPage(wikiPage.page_id);
  }

</script>
<div class="WikiPage card">
{#await refreshPromise then _}
  {#if !editing && wikiPage.body}
    <div class="flex-align-top">
      <BreadCrumb pageId={wikiPage.page_id}/>
      <Menu origin="top right">
        <div slot="activator">
          <MenuButton />
        </div>
        <Menuitem on:click={onEditPushed}>Edit</Menuitem>
        <Menuitem style="color: var(--danger);" on:click={onDeletePushed}>Deletef</Menuitem>
      </Menu>
    </div>
    <RstViewer rst={wikiPage.body}/>
  {:else if !editing}
    <div class="flex-align-top">
      <BreadCrumb pageId={wikiPage.page_id}/>
    </div>
    <p>
      Page does not exist.
      <Button on:click={onEditPushed}>Create</Button>
    </p>
  {:else}
    <WikiPageForm on:saved={onSaved} on:cancel={onEditingCanceled} {...wikiPage} />
  {/if}
{/await}
  <DeleteConfirmationDialog
    bind:visible={showDeleteConfirmation}
    message="Delete the wiki '{wikiPage ? wikiPage.page_id: ''}' ?"
    on:do-delete={doDelete}
  />
</div>
