<?php
/**
 * /contatti — il modulo che invia davvero, più orari e indirizzo dal gestionale.
 */
get_header();

$centro   = rb_centro();
$telefono = rb_telefono();
$whatsapp = rb_whatsapp_url();
$mappa    = 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( 'RevoBeauty ' . ( $centro['indirizzo'] ?? 'Maddaloni' ) );
?>

<section class="sezione testata-pagina">
	<p class="occhiello sale">Contatti</p>
	<h1 class="titolone sale">Scrivici: ti rispondiamo su WhatsApp.</h1>
	<p class="sottotitolo sale">Lasciaci il numero e ti scriviamo noi su WhatsApp per fissare l'appuntamento. Se preferisci sentire una voce, il telefono è qui sotto.</p>
</section>

<?php /* La faccia del posto, prima del modulo: si scrive più volentieri a un
	luogo che si è visto. La foto è il centro vero, in via Caudina. */ ?>
<?php if ( is_readable( RB_DUE_DIR . '/assets/img/banco.webp' ) ) : ?>
<section class="sezione foto-contatti sipario-taglio">
	<picture>
		<source type="image/avif" sizes="(max-width: 1120px) 100vw, 1072px" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/banco-800.avif 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/banco.avif 1400w" />
		<img src="<?php echo esc_url( RB_DUE_URI . '/assets/img/banco.webp' ); ?>" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/banco-800.webp 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/banco.webp 1400w" sizes="(max-width: 1120px) 100vw, 1072px" alt="Gli scaffali illuminati e il bancone di RevoBeauty in via Caudina 30 a Maddaloni" width="1400" height="1050" loading="lazy" decoding="async" />
	</picture>
</section>
<?php endif; ?>

<section class="sezione contatti-griglia">
	<div class="contatti-modulo sale">
		<?php echo rb_modulo_contatti(); // phpcs:ignore ?>
	</div>
	<aside class="contatti-lato">
		<div class="lato-blocco sale">
			<h2 class="fondo-titolo">Dove siamo</h2>
			<p><?php echo esc_html( $centro['indirizzo'] ?? 'Maddaloni (CE)' ); ?></p>
			<p><a class="collega" href="<?php echo esc_url( $mappa ); ?>" rel="noopener">Apri in Google Maps →</a></p>
		</div>
		<div class="lato-blocco sale">
			<h2 class="fondo-titolo">Orari</h2>
			<?php $righe = rb_orari_righe(); ?>
			<?php if ( $righe ) : ?>
				<dl class="orari">
					<?php foreach ( $righe as $riga ) : ?>
						<div class="orari-riga"><dt><?php echo esc_html( $riga[0] ); ?></dt><dd><?php echo esc_html( $riga[1] ); ?></dd></div>
					<?php endforeach; ?>
				</dl>
			<?php endif; ?>
		</div>
		<div class="lato-blocco sale">
			<h2 class="fondo-titolo">Subito</h2>
			<?php if ( $whatsapp ) : ?><p><a class="collega" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">WhatsApp →</a></p><?php endif; ?>
			<?php if ( $telefono ) : ?><p><a class="collega" href="tel:<?php echo esc_attr( $telefono ); ?>"><?php echo esc_html( $centro['telefono'] ); ?></a></p><?php endif; ?>
		</div>
	</aside>
</section>

<?php get_footer(); ?>
