<?php
/**
 * Testa della pagina: il critico inline, i font in preload, il resto defer.
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preload" href="<?php echo esc_url( RB_DUE_URI . '/assets/fonts/bodoni-moda-normal-400-700-latin.woff2' ); ?>" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="<?php echo esc_url( RB_DUE_URI . '/assets/fonts/archivo-normal-300-600-latin.woff2' ); ?>" as="font" type="font/woff2" crossorigin />
<style><?php
	// Il CSS critico, inline: niente giro di rete prima del primo dipinto.
	$critico = RB_DUE_DIR . '/assets/css/critical.css';
	if ( is_readable( $critico ) ) {
		// Il CSS è inline: gli URL relativi si romperebbero contro l'URL della
		// pagina, quindi i font usano un segnaposto risolto qui.
		echo str_replace( '__RB_FONTS__', RB_DUE_URI . '/assets/fonts', file_get_contents( $critico ) ); // phpcs:ignore
	}
?></style>
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<a class="salta" href="#contenuto">Vai al contenuto</a>

<header class="testata<?php echo is_front_page() ? ' testata-scura' : ''; ?>">
	<div class="testata-dentro">
		<a class="marchio" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="RevoBeauty — home">
			<span class="marchio-revo">REVO</span><span class="marchio-beauty">BEAUTY</span>
		</a>
		<nav class="nav" aria-label="Principale">
			<?php
			wp_nav_menu( array(
				'theme_location' => 'principale',
				'container'      => false,
				'items_wrap'     => '<ul class="menu">%3$s</ul>',
				'fallback_cb'    => 'rb_menu_fallback',
				'depth'          => 1,
			) );
			?>
		</nav>
		<div class="testata-azioni">
			<a class="bottone bottone-oro bottone-piccolo" href="<?php echo esc_url( rb_prenota_url() ); ?>">Prenota online</a>
			<button class="apri-menu" aria-expanded="false" aria-controls="menu-mobile" aria-label="Apri il menu">
				<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
			</button>
		</div>
	</div>
	<div class="menu-mobile" id="menu-mobile" hidden>
		<?php
		wp_nav_menu( array(
			'theme_location' => 'principale',
			'container'      => false,
			'items_wrap'     => '<ul class="menu-mobile-voci">%3$s</ul>',
			'fallback_cb'    => 'rb_menu_fallback',
			'depth'          => 1,
		) );
		?>
		<a class="bottone bottone-oro" href="<?php echo esc_url( rb_prenota_url() ); ?>">Prenota online</a>
	</div>
</header>

<main id="contenuto">
