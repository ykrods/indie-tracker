<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, Dialog } from 'svelte-mui';

  import TextArea from '../../mui/TextArea.svelte';
  import { addIssueComment, updateIssueComment } from '../../api';
  import RstViewer from '../../common/RstViewer.svelte';

  const dispatch = createEventDispatcher();

  export let issueId;
  export let body = '';
  export let id = null;

  let showPreview = false;

  $: previewEnabled = body !== '';
  $: saveEnabled = body !== '';

  async function onSaveButtonPushed() {
    if (id === null) {
      await addIssueComment(issueId, { body });
      body = '';
    } else {
      await updateIssueComment(issueId, id, { body });
    }
    dispatch('saved');
  }
  async function onCancelButtonPushed() {
    dispatch('canceled');
  }
  function onPreviewButtonPushed() {
    showPreview = true;
  }
</script>
<div>
  <TextArea
    bind:value={body}
    name="body"
    required
    rows={Math.min(body.split('\n').length + 3, 30)}
    label="body"
    style="font-family: monospace; font-size: 1em;"
  />

  {#if id !== null }
  <Button on:click={onCancelButtonPushed}>Cancel</Button>
  {/if}
  <Button disabled={!previewEnabled} on:click={onPreviewButtonPushed}>Preview</Button>
  <Button disabled={!saveEnabled} color="primary" on:click={onSaveButtonPushed}>Save</Button>

  <Dialog width="500" bind:visible={showPreview}>
    <div slot="title"p>Preview</div>
    <RstViewer rst={body}/>
  </Dialog>
</div>
