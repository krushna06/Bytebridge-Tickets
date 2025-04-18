<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { formatDistanceToNow } from 'date-fns';

  let feedback = [];
  let stats = {};
  let loading = true;
  let error = null;

  onMount(async () => {
    try {
      const response = await fetch(`${base}/api/guilds/${$page.params.guild}/feedback`);
      if (!response.ok) throw new Error('Failed to fetch feedback');
      const data = await response.json();
      feedback = data.feedback;
      stats = data.stats;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  function getRatingColor(rating) {
    const colors = {
      1: 'text-red-500',
      2: 'text-orange-500',
      3: 'text-yellow-500',
      4: 'text-lime-500',
      5: 'text-green-500'
    };
    return colors[rating] || 'text-gray-500';
  }
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-8">Feedback Overview</h1>

  {#if loading}
    <div class="flex justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      {error}
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Statistics</h2>
        <div class="space-y-2">
          <p>Total Feedback: {stats.total}</p>
          <p>Average Rating: {stats.averageRating.toFixed(1)} / 5</p>
          <div class="mt-4">
            <h3 class="font-medium mb-2">Rating Distribution</h3>
            {#each Object.entries(stats.distribution) as [rating, count]}
              <div class="flex items-center gap-2 mb-1">
                <span class={getRatingColor(rating)}>★</span>
                <span>{rating}:</span>
                <div class="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    class={`${getRatingColor(rating)} h-2 rounded-full`}
                    style="width: {(count / stats.total * 100)}%"
                  ></div>
                </div>
                <span class="text-sm">{count}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      {#each feedback as item}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="font-medium">{item.user.username}</span>
              <span class="text-sm text-gray-500">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </div>
            <div class={getRatingColor(item.rating)}>
              {#each Array(item.rating) as _}★{/each}
            </div>
          </div>
          {#if item.comment}
            <p class="text-gray-700 dark:text-gray-300">{item.comment}</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>