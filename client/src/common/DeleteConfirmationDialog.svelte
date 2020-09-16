<script>
  import { createEventDispatcher } from 'svelte';
  import { Dialog, Button } from 'svelte-mui';

  const dispatch = createEventDispatcher();

  export let visible = false;
  export let target = null;
  export let message = 'Are you sure?';

  function onCancelButtonPushed() {
    visible = false;
  }

  async function onDeleteButtonPushed() {
    visible = false;
    dispatch('do-delete', target);
  }

</script>

<Dialog bind:visible>
  <div slot="title">Confirmation</div>
  <p>{message}</p>
  <div slot="actions" class="actions center">
    <Button on:click={onCancelButtonPushed}>Cancel</Button>
    <Button style="color: var(--danger);" on:click={onDeleteButtonPushed}>Delete</Button>
  </div>
</Dialog>
