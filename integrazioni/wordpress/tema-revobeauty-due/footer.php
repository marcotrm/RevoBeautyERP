<?php
/**
 * Chiusura: orari e indirizzo dal gestionale, mai scritti a mano.
 */
$centro   = rb_centro();
$telefono = rb_telefono();
$whatsapp = rb_whatsapp_url();
?>
</main>

<footer class="fondo">
	<div class="fondo-dentro">
		<div class="fondo-colonna fondo-marchio">
			<div class="marchio"><span class="marchio-revo">REVO</span><span class="marchio-beauty">BEAUTY</span></div>
			<p class="fondo-claim">Innovazione &amp; bellezza, a Maddaloni.</p>
			<a class="bottone bottone-oro" href="<?php echo esc_url( rb_prenota_url() ); ?>">Prenota online</a>
		</div>

		<div class="fondo-colonna">
			<h2 class="fondo-titolo">Orari</h2>
			<?php $righe = rb_orari_righe(); ?>
			<?php if ( $righe ) : ?>
				<dl class="orari">
					<?php foreach ( $righe as $riga ) : ?>
						<div class="orari-riga"><dt><?php echo esc_html( $riga[0] ); ?></dt><dd><?php echo esc_html( $riga[1] ); ?></dd></div>
					<?php endforeach; ?>
				</dl>
			<?php else : ?>
				<p class="fondo-testo">Chiamaci o scrivici su WhatsApp per gli orari.</p>
			<?php endif; ?>
		</div>

		<div class="fondo-colonna">
			<h2 class="fondo-titolo">Contatti</h2>
			<address class="fondo-testo">
				<?php echo esc_html( $centro['indirizzo'] ?? 'Maddaloni (CE)' ); ?>
			</address>
			<?php if ( $telefono ) : ?>
				<p><a class="fondo-link" href="tel:<?php echo esc_attr( $telefono ); ?>"><?php echo esc_html( $centro['telefono'] ); ?></a></p>
			<?php endif; ?>
			<?php if ( $whatsapp ) : ?>
				<p><a class="fondo-link" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Scrivici su WhatsApp</a></p>
			<?php endif; ?>
		</div>
	</div>
	<div class="fondo-legale">
		<p>© <?php echo esc_html( gmdate( 'Y' ) ); ?> RevoBeauty · Maddaloni (CE)</p>
		<nav aria-label="Note legali">
			<a href="<?php echo esc_url( home_url( '/privacy-policy/' ) ); ?>">Privacy</a>
			<a href="<?php echo esc_url( home_url( '/cookie-policy/' ) ); ?>">Cookie</a>
			<button type="button" class="gestisci-cookie" id="rb-gestisci-cookie">Gestisci cookie</button>
		</nav>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
