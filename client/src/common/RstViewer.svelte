<script>
  import { onMount, tick } from 'svelte';

  import { push } from 'svelte-spa-history-router';

  import { getHTML } from '../api';

  export let rst;

  let html = "";
  let loading = false;

  $: refresh(rst);

  async function refresh(rst) {
    if (typeof rst !== 'string' || rst === '') {
      return ;
    }
    loading = true;
    html = await getHTML(rst);
    loading = false;
  };

  // Render mermaid diagram if contained
  $: if (typeof html === 'string' && html.includes('mermaid')) {
    tick().then(() => {
      mermaid.init();
    });
  }

  function captureClick(event) {
    if (event.target.tagName !== 'A') {
      return;
    }
    // Ignore external link
    if (event.target.hostname !== window.location.hostname) {
      return;
    }
    // Ignore fragment jump
    if (event.target.pathname === window.location.pathname &&
        event.target.hash !== window.location.hash) {
      return;
    }

    if (event.target.pathname) {
      event.preventDefault();
      push(event.target.href);
    }
  }
</script>
<div style="overflow: scroll" on:click={captureClick}>
  {#if html}
    {@html html}
  {:else if loading}
    <p style="text-align:center;color:#AAA;">loading...</p>
  {/if}
</div>
