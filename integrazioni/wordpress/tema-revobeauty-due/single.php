<?php
/** L'articolo singolo. */
get_header();
?>
<?php while ( have_posts() ) : the_post(); ?>
<article>
	<section class="sezione testata-pagina">
		<p class="occhiello sale"><?php echo esc_html( get_the_date( 'j F Y' ) ); ?></p>
		<h1 class="titolone sale"><?php the_title(); ?></h1>
	</section>
	<section class="sezione prosa">
		<?php the_content(); ?>
	</section>
</article>
<?php endwhile; ?>
<?php get_template_part( 'template-parts/cta-prenota' ); ?>
<?php get_footer(); ?>
