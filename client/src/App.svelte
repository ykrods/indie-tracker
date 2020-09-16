<script>
  import { onMount } from 'svelte';
  import { Router } from 'svelte-spa-history-router';

  import Header from './common/Header.svelte';
  import routes from './routes';
  import { db, socket, project } from './stores';
  import { getProject } from './api';
  import { projectDB } from './db';

  export let showSideBar = false;

  onMount(async () => {
    project.set(await getProject());
    db.set(projectDB($project));
    socket.open($project, $db);
  });

</script>

<div class="app">
  <Header/>
  <main>
    {#if showSideBar }
    <div class="sidebar">
      <div class="quicklink">
        <!-- WIP! -->
      </div>
    </div>
    {/if}
    <div class="main">
      <Router {routes}/>
    </div>
  </main>
  <footer>
    <a href="https://github.com/ykrods/indie-tracker" target="_blank">Indie Tracker</a>
  </footer>
</div>

<style>
  main {
    display: flex;
    min-height: calc(100vh - var(--header-height) - var(--footer-height));
    text-align: left;
  }
  main > .sidebar {
    flex: 0 0 200px;
    padding: 10px;
  }
  main > .main {
    flex: 1;
    max-width: 650px;
    margin: 10px auto;
  }

  /* for sidebar quicklink */
  ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
    text-align: left;
  }
  li {
    color: #AAA;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
      color: purple;
  }

  footer {
    height: var(--footer-height);
    color: #333;
    text-align: center;
    font-size: 0.9em;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
