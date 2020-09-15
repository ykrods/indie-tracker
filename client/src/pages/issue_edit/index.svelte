<script>
  import { push } from 'svelte-spa-history-router';

  import { project, socket, db } from '../../stores';
  import { addIssue } from '../../api';
  import IssueForm from '../../common/IssueForm.svelte';

  let title = '';

  $: if ($project) {
    window.document.title = `Create issue ${$project.name} - Indie Tracker`;
  };

  $: if ($socket && $socket.type === 'issue' && $socket.data.title === title) {
    // XXX: redirect to issue after created (..is there some better way?)
    push(`/issues/${$socket.data.id}`);
  }

  async function onSave(event) {
    // XXX: keep title to specify saving issue
    title = event.detail.title;

    try {
      await addIssue(event.detail);
    } catch(error) {
      console.error(error);
    }
  }

  function onCancel() {
    push(`/issues`);
  }
</script>
<div class="card issue-new">
  <h1>New Issue</h1>
  <IssueForm on:save={onSave} on:cancel={onCancel}/>
</div>
