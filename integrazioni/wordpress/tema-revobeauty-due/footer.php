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
	<a class="pollice-primario" href="<?php echo esc_url( rb_prenota_url() ); ?>">Prenota</a>
	<?php if ( $whatsapp ) : ?>
		<a class="pollice-icona" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener" aria-label="Scrivici su WhatsApp">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.03s.87 2.35 1 2.51c.12.17 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z"/></svg>
		</a>
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
