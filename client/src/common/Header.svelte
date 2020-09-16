<script>
import { onMount } from 'svelte';
import { link } from 'svelte-spa-history-router';

import { project } from '../stores';
import { getUserIdentity} from '../api';

let user_identity = '';

onMount(async() => {
    user_identity = await getUserIdentity();
});

</script>

<header>
  <div class="project-name">{ $project.name }</div>
  <a class="nav-link" use:link href="/">Issues</a>
  <a class="nav-link" use:link href="/wiki/">Wiki</a>
  <span class="user-identity">Commiter: { user_identity }</span>
</header>

<style>
  header {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    width: 100%;
    height: var(--header-height);

    display: flex;
    align-items: center;

    background-color: #fafafb;
    box-shadow: var(--bs-100);
  }

  .project-name {
    font-size: 1.4em;
    font-weight: bold;
    margin: 0 10px;
  }
  .nav-link {
    margin: 0 5px;
    font-weight: bold;
    color: #555;
  }
  .nav-link {
    margin: 0 10px;
    font-weight: bold;
    text-decoration: none;
  }
  .nav-link:link, .nav-link:visited {
    color: #777;;
  }
  .nav-link:hover {
    color: var(--accent);
  }

  .user-identity {
    margin: 0 10px 0 auto;
  }
</style>
