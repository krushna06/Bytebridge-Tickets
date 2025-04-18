<script>
	import TopBar from '$components/TopBar.svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page, navigating } from '$app/stores';
	import { Modals, modals } from 'svelte-modals';
	import cookie from 'cookie';
	import WelcomeModal from '$components/WelcomeModal.svelte';
	import Spinner from '$components/Spinner.svelte';
	/** @type {{data: import('./$types').PageData, children?: import('svelte').Snippet}} */
	let { data, children } = $props();

	const { client, user, theme } = data;
	let mounted = $state(false);
	let cookies = $state({});
	onMount(() => {
		cookies = cookie.parse(document.cookie || '');
		if (!cookies.welcomed) modals.open(WelcomeModal, { client });
		mounted = true;
	});

	const dismissCookies = () => {
		document.cookie = cookie.serialize('dismissedCookies', 'true', {
			maxAge: 2592000,
			path: '/',
			sameSite: 'lax'
		});
		cookies.dismissedCookies = true;
	};

	const links = [
		{
			icon: 'fa-solid fa-book',
			name: 'Documentation',
			url: 'https://discordtickets.app'
		},
		{
			icon: 'fab fa-discord',
			name: 'Support',
			url: 'https://lnk.earth/discord'
		},
		{
			icon: 'fa-solid fa-comments',
			name: 'Feedback',
			url: 'https://lnk.earth/dsctickets-feedback'
		}
	];
</script>

<svelte:head>
	<title>Discord Tickets</title>
	<link rel="icon" href="/favicon.png" />
</svelte:head>

<div class="absolute h-max min-h-screen w-full bg-gray-200 dark:bg-slate-900">
	<Modals>
		{#snippet backdrop({ close })}
			<div
				class="backdrop"
				transition:fade
				onclick={() => close()}
				onkeypress={() => close()}
			></div>
		{/snippet}
		{#snippet loading()}
			<div>
				<Spinner />
			</div>
		{/snippet}
	</Modals>
	{#if mounted && client.public && !cookies.dismissedCookies}
		<div
			class="m-0 flex w-full flex-row justify-center gap-8 bg-blurple p-1 font-medium text-white sm:px-8"
		>
			<p>Cookies are being used to store credentials and preferences.</p>
			<p>
				<i
					class="fa-sharp fa-solid fa-circle-xmark justify-self-end hover:cursor-pointer"
					title="Dismiss"
					onclick={dismissCookies}
					onkeypress={dismissCookies}
				></i>
			</p>
		</div>
	{/if}
	<div class="text-gray-800 dark:text-slate-300">
		{#if $navigating || !mounted}
			<div class="flex h-dvh items-center justify-center">
				<Spinner />
			</div>
		{:else}
			<div class="m-2 sm:m-6 lg:m-12">
				<div class="mx-auto max-w-7xl">
					<TopBar {user} {theme} />
					{@render children?.()}
					<footer class="my-16 text-center">
						<div class="mb-6 p-2 text-sm">
							<a
								href="/"
								class="cursor-pointer text-gray-500 transition duration-300 hover:text-blurple dark:text-slate-400 dark:hover:text-blurple"
							>
								<i class="fa-solid fa-arrow-left"></i>
								Back to the portal
							</a>
						</div>
					</footer>
				</div>
			</div>
		{/if}
	</div>
</div>
