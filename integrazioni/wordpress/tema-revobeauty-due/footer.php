<?php
/**
 * Chiusura: orari e indirizzo dal gestionale, mai scritti a mano.
 */
$centro   = rb_centro();
$telefono = rb_telefono();
$whatsapp = rb_whatsapp_url();
?>
</main>

<?php /*
	La barra del pollice: su un telefono l'azione che porta soldi deve stare
	dove arriva il dito senza spostare la mano, e deve essere sempre lì.
	Non compare subito: dentro la prima schermata i tasti ci sono già, e
	ripeterli sarebbe solo rumore che copre la foto. Il padding in fondo
	tiene conto della barra dei gesti dell'iPhone, altrimenti il tasto
	finisce sotto la tacca e non si tocca.
*/ ?>
<div class="barra-pollice" id="barra-pollice" aria-label="Azioni rapide">
	<?php if ( $whatsapp ) : ?>
		<a class="pollice-primario" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
	<?php endif; ?>
	<?php if ( $telefono ) : ?>
		<a class="pollice-icona" href="tel:<?php echo esc_attr( $telefono ); ?>" aria-label="Chiama il centro">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</a>
	<?php endif; ?>
</div>

<footer class="fondo">
	<div class="fondo-dentro">
		<div class="fondo-colonna fondo-marchio">
			<div class="marchio"><span class="marchio-revo">REVO</span><span class="marchio-beauty">BEAUTY</span></div>
			<p class="fondo-claim">Innovazione &amp; bellezza, a Maddaloni.</p>
			<?php if ( $whatsapp ) : ?><a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a><?php endif; ?>
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
		<p>© <?php echo esc_html( gmdate( 'Y' ) ); ?> RevoBeauty · Maddaloni (CE) · P.IVA 10625841217</p>
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
