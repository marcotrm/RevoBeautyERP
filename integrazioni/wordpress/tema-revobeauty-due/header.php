<?php
/**
 * Testa della pagina: il critico inline, i font in preload, il resto defer.
 */
$whatsapp = rb_whatsapp_url();
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preload" href="<?php echo esc_url( RB_DUE_URI . '/assets/fonts/montserrat-variabile-300-700-latin.woff2' ); ?>" as="font" type="font/woff2" crossorigin />
<?php /* L'immagine dell'eroe e' l'elemento piu' grande della prima
	schermata: senza preload il browser la scopre solo dopo aver letto
	l'HTML, e sono decimi di secondo persi sul tempo che Google misura.
	Il type= fa sì che chi non legge avif ignori la riga e resti sul webp
	del <picture>: nessun byte sprecato. */ ?>
<?php if ( is_front_page() && is_readable( RB_DUE_DIR . '/assets/img/hero-full-1400.avif' ) ) : ?>
<link rel="preload" as="image" type="image/avif" fetchpriority="high"
	href="<?php echo esc_url( RB_DUE_URI . '/assets/img/hero-full-1400.avif' ); ?>"
	imagesrcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-800.avif 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-1400.avif 1400w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-2000.avif 2000w"
	imagesizes="100vw" />
<?php endif; ?>
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

<?php if ( is_front_page() ) : ?>
<?php /*
	La schermata di entrata: due pannelli neri, il logotipo che emerge, una
	barra sottile, poi il sipario si apre. Parte SOLO alla prima visita
	(localStorage, vedi motion.js) e solo se il movimento non è ridotto:
	nell'HTML arriva spenta (hidden) e senza JS non esiste — la pagina
	sotto è già completa. Coreografia presa dal preload di lindas,
	compressa da 3,5 a ~2,2 secondi: l'attesa scenografica va bene una
	volta, non a ogni caffè.
*/ ?>
<div class="entrata" id="rb-entrata" hidden aria-hidden="true">
	<div class="entrata-pannello entrata-sopra"></div>
	<div class="entrata-pannello entrata-sotto"></div>
	<div class="entrata-scena">
		<?php /*
			Il monogramma disegnato, non una figura da scaricare: l'entrata
			deve dipingersi al primo pennello, e una <img> arriverebbe dopo —
			si vedrebbe il buco. Sono due tracciati separati, la R e la B,
			perche' il logo si COMPONE: arrivano dai due lati e si incontrano.
			Con un tracciato solo si potrebbe solo farlo comparire.
		*/ ?>
		<svg class="entrata-marchio" viewBox="0 0 1000 833" aria-hidden="true" focusable="false">
			<defs>
				<path id="rb-e-r" d="M42 832C42 831 34 830 21 830L0 830L0 416L0 1L128 2C263 2 284 3 304 7C338 13 376 28 402 46C407 49 412 51 413 51C419 51 445 74 460 93C479 117 496 148 504 177C512 205 512 209 512 244C512 272 512 277 510 290C507 304 500 330 498 331C497 332 493 342 493 345C493 347 492 348 492 348C490 349 479 371 479 373C479 374 478 375 478 376C477 376 474 378 472 381C464 394 452 409 448 412C446 414 445 416 445 418C445 420 442 423 438 424C436 424 433 428 431 431C430 433 428 434 427 435C426 436 424 438 422 440C420 442 418 444 417 444C416 444 413 446 411 448C408 451 405 453 403 454C401 454 398 456 397 457C395 459 388 463 380 467C369 473 366 474 359 474C354 475 350 476 350 476C349 477 346 478 342 479C338 480 333 481 331 482C328 484 323 485 320 485C316 485 310 485 307 486C301 487 300 488 300 490C300 491 301 493 302 494C303 494 304 496 304 496C304 498 309 503 310 503C311 503 313 505 315 508C316 511 322 520 326 527C341 551 349 564 366 593C376 609 387 627 392 634C419 675 451 692 502 692L512 692L512 753C511 786 511 818 511 824L511 833L503 832C498 832 493 832 491 832C448 832 441 832 439 831C438 831 432 830 424 830C414 830 410 829 410 828C409 827 398 823 391 822C389 822 386 821 384 821C382 820 380 820 380 819C380 817 371 812 367 812C360 812 326 783 314 766C311 762 303 748 296 736C252 660 233 626 225 613C220 604 208 582 196 563C186 544 172 520 166 511C160 501 156 492 156 491C156 489 155 488 146 488C141 487 134 487 130 487L122 487L123 495C124 506 126 804 124 819L124 830L115 830C110 830 107 831 107 832C107 832 104 833 100 833C96 833 93 832 93 832C93 831 88 830 81 830C73 830 68 831 68 832C68 832 63 833 55 833C47 833 42 832 42 832ZM286 357C313 353 335 343 352 326C366 312 374 298 381 278C384 269 384 266 384 247C384 228 384 226 381 217C376 202 371 192 362 180C354 168 344 159 334 152C324 145 306 138 293 135C282 133 279 133 202 132L123 132L123 138C124 141 124 192 125 251L125 358L202 358C247 358 281 358 286 357Z"/>
				<path id="rb-e-b" d="M563 766C563 730 563 698 563 696L563 691L654 691C718 691 748 690 758 690C786 686 807 677 825 660C839 645 850 625 854 606C858 592 857 565 853 551C852 546 850 540 850 538C849 531 844 523 836 512C829 502 819 493 807 485C790 474 784 472 763 469C755 468 502 469 502 470C502 470 499 471 496 471C491 471 490 471 490 468C490 467 492 464 495 461C513 444 536 406 549 375C554 364 562 340 562 337C562 336 567 336 598 336C662 335 674 335 686 332C713 327 737 309 750 284C757 270 760 259 761 242C762 224 760 213 754 198C752 193 750 187 749 185C749 184 746 180 743 176C740 173 737 170 737 168C737 165 723 152 713 147C700 140 694 138 682 136C671 133 667 133 605 134L540 134L538 129C537 127 534 119 530 112C526 105 523 98 523 98C523 95 508 74 497 60C481 42 467 28 453 17C444 10 440 7 440 5C440 4 441 2 442 2C443 2 495 1 558 1C645 1 675 1 683 2C688 3 693 4 693 5C693 5 697 6 702 7C733 14 760 25 786 41C790 44 795 47 796 47C797 47 799 48 799 49C800 51 802 52 803 52C807 52 828 70 837 80C864 111 882 145 890 187C893 201 894 204 894 228C894 250 893 257 891 268C887 291 878 319 872 328C867 336 861 350 860 355L860 360L870 365C899 380 929 405 950 431C975 463 995 510 999 551C1000 566 1000 594 999 609C995 648 979 689 955 725C953 729 950 732 950 733C950 733 947 736 944 740C922 768 894 790 866 804C847 813 830 819 809 824C786 829 780 830 731 830C704 830 683 831 683 832C683 832 671 833 658 833C642 833 632 832 632 832C632 831 628 830 621 830C615 830 610 831 610 832C610 832 601 833 586 832L563 832L563 766Z"/>
				<linearGradient id="rb-e-oro" x1="0" y1="0" x2="1000" y2="833" gradientUnits="userSpaceOnUse">
					<stop offset="0" stop-color="#e2d0a0"/><stop offset=".38" stop-color="#b59b53"/>
					<stop offset=".62" stop-color="#d9c68d"/><stop offset="1" stop-color="#8f7a3f"/>
				</linearGradient>
				<linearGradient id="rb-e-lucido" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stop-color="#fff" stop-opacity="0"/>
					<stop offset=".5" stop-color="#fff" stop-opacity=".5"/>
					<stop offset="1" stop-color="#fff" stop-opacity="0"/>
				</linearGradient>
				<clipPath id="rb-e-sagoma">
					<use href="#rb-e-r" clip-rule="evenodd"/><use href="#rb-e-b" clip-rule="evenodd"/>
				</clipPath>
			</defs>
			<use class="rb-erre" href="#rb-e-r" fill="url(#rb-e-oro)" fill-rule="evenodd"/>
			<use class="rb-bi" href="#rb-e-b" fill="url(#rb-e-oro)" fill-rule="evenodd"/>
			<g clip-path="url(#rb-e-sagoma)">
				<rect class="rb-lucido" x="-420" y="-120" width="300" height="1073" fill="url(#rb-e-lucido)" transform="skewX(-18)"/>
			</g>
		</svg>
		<span class="entrata-logotipo"><span class="firma-revo">REVO</span><span class="firma-beauty">BEAUTY</span></span>
		<span class="entrata-riga">Maddaloni · Via Caudina 30</span>
	</div>
	<div class="entrata-barra"><span></span></div>
</div>
<script>
/* Acceso qui e non nel bundle: il bundle è differito e arriverebbe a pagina
   già dipinta — l'intro deve esserci al primo pennello o non esserci. */
(function () {
	try {
		if (localStorage.getItem('rb_intro')) return;
		if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		var e = document.getElementById('rb-entrata');
		e.hidden = false;
		e.classList.add('entrata-avviata');
		document.body.setAttribute('data-entrata', '');
		localStorage.setItem('rb_intro', '1');
	} catch (err) {}
})();
</script>
<?php endif; ?>

<?php /* La testata è scura ovunque: le pagine interne ora si aprono con
	la loro scena nera (vedi .testata-pagina) e il footer chiude in nero —
	il contenuto sta tra due bande scure, come un fotogramma. In home resta
	anche il galleggiamento sull'eroe (testata-cinema). */ ?>
<header class="testata testata-scura<?php echo is_front_page() ? ' testata-cinema' : ''; ?>">
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
			<?php if ( $whatsapp ) : ?>
				<a class="bottone bottone-oro bottone-piccolo" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
			<?php endif; ?>
			<?php /* L'icona da sola non basta: senza la parola scritta, quante persone
				trovano la navigazione si dimezza. Costa tre lettere. */ ?>
			<button class="apri-menu" aria-expanded="false" aria-controls="menu-mobile">
				<svg class="segno-menu" width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
				<svg class="segno-chiudi" width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M5 5l12 12M17 5L5 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
				<span class="parola-menu">Menu</span>
				<span class="parola-chiudi">Chiudi</span>
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
		<?php if ( $whatsapp ) : ?>
			<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
		<?php endif; ?>
	</div>
</header>

<main id="contenuto">
