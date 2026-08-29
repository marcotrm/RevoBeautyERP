<?php
/** L'invito finale, uguale su tutte le pagine: due strade, prenoti o scrivi. */
$whatsapp = rb_whatsapp_url();
$telefono = rb_telefono();
?>
<section class="chiusura">
	<h2 class="chiusura-titolo sale">Il posto giusto si riconosce da come ti senti quando esci.</h2>
	<div class="chiusura-azioni sale">
		<?php if ( $whatsapp ) : ?>
			<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
		<?php endif; ?>
		<?php if ( $telefono ) : ?>
			<a class="collega collega-chiaro" href="tel:<?php echo esc_attr( $telefono ); ?>">oppure chiamaci</a>
		<?php endif; ?>
	</div>
</section>
