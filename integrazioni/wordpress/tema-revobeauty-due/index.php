<?php
/**
 * Il blog: l'elenco degli articoli. index.php fa anche da rete di sicurezza
 * per qualsiasi vista senza template dedicato.
 */
get_header();
?>
<section class="sezione testata-pagina">
	<p class="occhiello sale">Blog</p>
	<h1 class="titolone sale"><?php echo is_home() ? 'Consigli e guide' : esc_html( get_the_archive_title() ); ?></h1>
	<p class="sottotitolo sale">Come funzionano i trattamenti, come prepararsi, cosa aspettarsi: le risposte che diamo ogni giorno al banco, scritte bene.</p>
</section>

<?php if ( is_home() && is_readable( RB_DUE_DIR . '/assets/img/blog-testata.webp' ) ) : ?>
<section class="foto-categoria quadro quadro-16x9">
	<picture>
		<source type="image/avif" sizes="100vw" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/blog-testata-800.avif 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/blog-testata.avif 1024w" />
		<img src="<?php echo esc_url( RB_DUE_URI . '/assets/img/blog-testata.webp' ); ?>" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/blog-testata-800.webp 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/blog-testata.webp 1024w" sizes="100vw" alt="" width="1024" height="559" loading="lazy" decoding="async" />
	</picture>
</section>
<?php endif; ?>

<section class="sezione elenco-articoli">
	<?php if ( have_posts() ) : ?>
		<?php while ( have_posts() ) : the_post(); ?>
			<article class="anteprima sale">
				<a class="anteprima-collega" href="<?php the_permalink(); ?>">
					<span class="anteprima-data"><?php echo esc_html( get_the_date( 'j F Y' ) ); ?></span>
					<h2 class="anteprima-titolo"><?php the_title(); ?></h2>
					<p class="anteprima-riassunto"><?php echo esc_html( wp_trim_words( get_the_excerpt(), 26 ) ); ?></p>
					<span class="collega">Leggi →</span>
				</a>
			</article>
		<?php endwhile; ?>
		<nav class="paginazione"><?php the_posts_pagination( array( 'prev_text' => '← Più recenti', 'next_text' => 'Più vecchi →' ) ); ?></nav>
	<?php else : ?>
		<p class="sottotitolo">Ancora nessun articolo qui.</p>
	<?php endif; ?>
</section>
<?php get_footer(); ?>
