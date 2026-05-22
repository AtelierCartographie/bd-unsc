<script>
	let { svgElement, ...rest } = $props();

	/** @param {HTMLElement} node */
	function myplot(node) {
		node.appendChild(svgElement);
	}
</script>

{#key svgElement}
	<div use:myplot {...rest}></div>
{/key}
