<?php
/**
 * Le pagine semplici (privacy, cookie policy): il contenuto vive in bacheca,
 * così si corregge senza toccare il codice.
 */
get_header();
?>
<section class="sezione testata-pagina">
	<h1 class="titolone sale"><?php the_title(); ?></h1>
</section>
<section class="sezione prosa">
	<?php
	while ( have_posts() ) :
		the_post();
		the_content();
	endwhile;
	?>
</section>
<?php get_footer(); ?>
