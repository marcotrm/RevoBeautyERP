<?php
/** L'invito finale, uguale su tutte le pagine: due strade, prenoti o scrivi. */
$whatsapp = rb_whatsapp_url();
$telefono = rb_telefono();
?>
<section class="chiusura">
	<?php /* L'unica frase del sito che si scrive parola per parola: è l'ultima
	cosa che si legge prima del tasto, ed è lì che vale la pena far rallentare
	l'occhio. Ovunque altro sarebbe insopportabile. */ ?>
	<h2 class="chiusura-titolo sale inchiostro"><?php echo rb_parole( 'Il posto giusto si riconosce da come ti senti quando esci.' ); // phpcs:ignore ?></h2>
	<div class="chiusura-azioni sale">
		<?php if ( $whatsapp ) : ?>
			<span class="alone"><a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a></span>
		<?php endif; ?>
		<?php if ( $telefono ) : ?>
			<a class="collega collega-chiaro" href="tel:<?php echo esc_attr( $telefono ); ?>">oppure chiamaci</a>
		<?php endif; ?>
	</div>
</section>
