<script>
import { link } from 'svelte-spa-history-router';
import makeBreadCrumbs from './makeBreadCrumbs';

export let pageId = '';

$: breadCrumbs = makeBreadCrumbs(pageId);

</script>
<div>
  {#each breadCrumbs as bs, i}
    {#if 0 < i }
    <span class="separator">/</span>
    {/if}
    {#if bs.link }
    <a use:link href="{bs.link}">{bs.name}</a>
    {:else}
    {bs.name}
    {/if}
  {/each}
</div>

<style>
.separator {
  padding: 0 3px 0 6px;
}
</style>
