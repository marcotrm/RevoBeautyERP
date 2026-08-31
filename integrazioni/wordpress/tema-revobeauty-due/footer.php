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

<?php /*
	Il fondo pagina, in un pezzo solo: invito, firma, colonne, riga legale.
	Prima l'invito finale e il footer erano due blocchi neri staccati da un
	filo di crema — il «footer spezzato» che il cliente ha segnalato. Il
	modello è il footer di lindas: fascia d'invito, logotipo a piena
	larghezza come firma, quattro colonne sopra un filo di bianco al 16%,
	riga legale in fondo.
*/ ?>
<footer class="fondo" id="fondo">

	<div class="fondo-invito">
		<h2 class="fondo-invito-titolo sale">Il posto giusto si riconosce da come ti senti quando esci.</h2>
		<div class="fondo-invito-azioni sale">
			<?php if ( $whatsapp ) : ?>
				<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener"><span>Prenota su WhatsApp</span></a>
			<?php endif; ?>
			<?php if ( $telefono ) : ?>
				<a class="collega collega-chiaro" href="tel:<?php echo esc_attr( $telefono ); ?>">oppure chiamaci</a>
			<?php endif; ?>
		</div>
	</div>

	<?php /* La firma: il logotipo a tutta larghezza, in caratteri e non in
		immagine — si ridisegna nitido a qualsiasi misura e non pesa nulla. */ ?>
	<div class="fondo-firma" aria-hidden="true">
		<span class="firma-revo">REVO</span><span class="firma-beauty">BEAUTY</span>
	</div>

	<div class="fondo-dentro">
		<div class="fondo-colonna">
			<h2 class="fondo-titolo">Il centro</h2>
			<p class="fondo-testo">Estetica avanzata a Maddaloni: tecnologie recenti, un metodo semplice — prima ascoltare, poi trattare.</p>
		</div>

		<div class="fondo-colonna">
			<h2 class="fondo-titolo">Naviga</h2>
			<ul class="fondo-voci">
				<li><a class="fondo-link" href="<?php echo esc_url( home_url( '/servizi/' ) ); ?>">Trattamenti</a></li>
				<li><a class="fondo-link" href="<?php echo esc_url( home_url( '/chi-siamo/' ) ); ?>">Chi siamo</a></li>
				<li><a class="fondo-link" href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a></li>
				<li><a class="fondo-link" href="<?php echo esc_url( home_url( '/contatti/' ) ); ?>">Contatti</a></li>
			</ul>
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
			<address class="fondo-testo"><?php echo esc_html( $centro['indirizzo'] ?? 'Maddaloni (CE)' ); ?></address>
			<ul class="fondo-voci">
				<?php if ( $telefono ) : ?>
					<li><a class="fondo-link" href="tel:<?php echo esc_attr( $telefono ); ?>"><?php echo esc_html( $centro['telefono'] ); ?></a></li>
				<?php endif; ?>
				<?php if ( $whatsapp ) : ?>
					<li><a class="fondo-link" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">WhatsApp</a></li>
				<?php endif; ?>
			</ul>
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
