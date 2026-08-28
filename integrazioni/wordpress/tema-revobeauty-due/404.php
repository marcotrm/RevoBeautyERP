<?php
/** Pagina non trovata. */
get_header();
?>
<section class="sezione testata-pagina">
	<p class="occhiello">Errore 404</p>
	<h1 class="titolone">Questa pagina non c'è.</h1>
	<p class="sottotitolo">Forse il link è vecchio. Le cose importanti sono qui sotto.</p>
	<p><a class="bottone bottone-oro" href="<?php echo esc_url( home_url( '/' ) ); ?>">Torna alla home</a></p>
</section>
<?php get_footer(); ?>
