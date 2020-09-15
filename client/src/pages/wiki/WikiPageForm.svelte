<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, Textfield, Dialog } from 'svelte-mui';

  import { putWikiPage } from '../../api';
  import TextArea from '../../mui/TextArea.svelte';
  import RstViewer from '../../common/RstViewer.svelte';

  const dispatch = createEventDispatcher();

  export let page_id = '';
  export let body = '';

  let showPreview = false;

  $: saveEnabled = page_id !== '' && body !== '';
  $: previewEnabled = body !== '';

  async function onSaveButtonPushed() {
    const data = await putWikiPage(page_id, { body });
    dispatch('saved', data);
  }
  function onCancelButtonPushed() {
    dispatch('cancel');
  }
</script>
<div class="form">
  <Textfield
    name="path"
    autocomplete="off"
    required
    bind:value={page_id}
    label="path"
    message=""
  />

  <TextArea
    bind:value={body}
    name="body"
    required
    rows={Math.min(body.split('\n').length + 3, 50)}
    label="body"
    style="font-family: monospace; font-size: 1em;"
  />

  <Button on:click="{onCancelButtonPushed}">Cancel</Button>
  <Button disabled={!previewEnabled} on:click={() => { showPreview = true }}>Preview</Button>
  <Button disabled={!saveEnabled} color="primary" on:click={onSaveButtonPushed}>Save</Button>

  <Dialog width="500" bind:visible={showPreview}>
    <div slot="title"p>Preview</div>
    <RstViewer rst={body}/>
  </Dialog>
</div>
