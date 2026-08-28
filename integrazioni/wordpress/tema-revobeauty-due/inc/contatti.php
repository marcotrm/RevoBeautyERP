<?php
/**
 * Il modulo contatti che invia davvero.
 *
 * Adattato dal mu-plugin collaudato in integrazioni/wordpress/
 * revobeauty-contatti.php: stessa logica (POST lato server al gestionale,
 * honeypot, nonce, esito nell'URL), markup del nuovo tema. Vive nel tema
 * così un solo ZIP installa tutto.
 *
 * Il telefono è obbligatorio e l'email no: il seguito è su WhatsApp, senza
 * numero il contatto è una riga che nessuno richiama. La casella marketing
 * è separata dalla privacy: il consenso unico che condiziona la risposta
 * alla richiesta non è un consenso.
 *
 * In wp-config.php (facoltativi ma consigliati):
 *   define( 'REVOBEAUTY_ERP_URL', 'https://erp.revobeauty.it' );
 *   define( 'REVOBEAUTY_LEAD_SECRET', 'lo-stesso-segreto-di-LEAD_SECRET-su-Railway' );
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const RB_AZIONE = 'rb_contatto';
const RB_NONCE  = 'rb_contatto_nonce';

/** Il modulo, come shortcode e come funzione per i template. */
function rb_modulo_contatti() {
	$esito  = isset( $_GET['contatto'] ) ? sanitize_key( wp_unslash( $_GET['contatto'] ) ) : '';
	$errore = isset( $_GET['errore'] ) ? sanitize_text_field( wp_unslash( $_GET['errore'] ) ) : '';

	ob_start();

	if ( 'ok' === $esito ) : ?>
		<div class="form-esito" id="contact-form">
			<p class="form-esito-titolo">Ricevuto, grazie.</p>
			<p class="form-esito-testo">Ti scriviamo su WhatsApp al numero che ci hai lasciato: da lì fissiamo l'appuntamento senza che tu debba richiamare.</p>
		</div>
		<script>
		/* L'unico punto in cui si sa che la richiesta è arrivata davvero al
		   gestionale: è qui che si misura la conversione, non al click. */
		(function () {
			try { if (typeof gtag === 'function') { gtag('event', 'generate_lead', { form: 'contatti' }); } } catch (e) {}
			try { if (typeof fbq === 'function') { fbq('track', 'Lead'); } } catch (e) {}
		})();
		</script>
	<?php else :
		if ( $errore ) : ?>
			<div class="form-errore" role="alert"><?php echo esc_html( $errore ); ?></div>
		<?php endif; ?>

		<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post" class="form-contatti" id="contact-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( RB_AZIONE ); ?>" />
			<?php wp_nonce_field( RB_AZIONE, RB_NONCE ); ?>
			<input type="hidden" name="pagina" value="<?php echo esc_url( home_url( add_query_arg( array() ) ) ); ?>" />

			<?php /* Campo trappola: invisibile alle persone, irresistibile per i bot. */ ?>
			<div class="hp" aria-hidden="true">
				<label for="azienda">Azienda</label>
				<input type="text" id="azienda" name="azienda" tabindex="-1" autocomplete="off" />
			</div>

			<div class="form-riga">
				<div class="form-campo">
					<label for="nome">Nome <span class="oro">*</span></label>
					<input type="text" id="nome" name="nome" required autocomplete="given-name" placeholder="Il tuo nome" />
				</div>
				<div class="form-campo">
					<label for="cognome">Cognome</label>
					<input type="text" id="cognome" name="cognome" autocomplete="family-name" placeholder="Il tuo cognome" />
				</div>
			</div>

			<div class="form-riga">
				<div class="form-campo">
					<label for="telefono">Cellulare <span class="oro">*</span></label>
					<input type="tel" id="telefono" name="telefono" required autocomplete="tel" placeholder="333 123 4567" />
					<p class="form-nota">Ti rispondiamo su WhatsApp a questo numero.</p>
				</div>
				<div class="form-campo">
					<label for="email">Email</label>
					<input type="email" id="email" name="email" autocomplete="email" placeholder="email@esempio.it" />
				</div>
			</div>

			<div class="form-campo">
				<label for="servizio">Servizio di interesse</label>
				<select id="servizio" name="servizio">
					<option value="">Scegli un servizio</option>
					<?php
					// Le voci del menu sono le categorie vere del listino.
					$listino = rb_listino();
					$slug_categorie = is_array( $listino ) && ! empty( $listino['categorie'] ) ? $listino['categorie'] : array( 'laser', 'waxing', 'body', 'facial', 'massage', 'nails', 'consultation' );
					foreach ( rb_ordina_categorie( $slug_categorie ) as $slug ) {
						printf( '<option value="%s">%s</option>', esc_attr( rb_nome_categoria( $slug ) ), esc_html( rb_nome_categoria( $slug ) ) );
					}
					?>
					<option value="Altro">Altro</option>
				</select>
			</div>

			<div class="form-campo">
				<label for="messaggio">Messaggio</label>
				<textarea id="messaggio" name="messaggio" rows="4" placeholder="Dicci di cosa hai bisogno e quando ti farebbe comodo passare"></textarea>
			</div>

			<label class="form-check">
				<input type="checkbox" name="privacy" value="1" required />
				<span>Ho letto e accetto l'<a href="<?php echo esc_url( home_url( '/privacy-policy/' ) ); ?>">informativa sulla privacy</a>. I dati servono a risponderti e a fissare l'appuntamento. <span class="oro">*</span></span>
			</label>

			<label class="form-check">
				<input type="checkbox" name="marketing" value="1" />
				<span>Voglio ricevere anche promozioni e novità (facoltativo, si disdice quando vuoi).</span>
			</label>

			<button type="submit" class="bottone bottone-oro form-invia">Invia richiesta</button>
		</form>
	<?php endif;

	return ob_get_clean();
}
add_shortcode( 'revobeauty_contatti', 'rb_modulo_contatti' );

/** Torna alla pagina con l'esito, senza lasciare un POST in cronologia. */
function rb_torna( $pagina, $args ) {
	$base = $pagina ? esc_url_raw( $pagina ) : home_url( '/contatti/' );
	wp_safe_redirect( add_query_arg( $args, remove_query_arg( array( 'contatto', 'errore' ), $base ) ) . '#contact-form' );
	exit;
}

/**
 * L'invio: dal server, non dal browser. Il segreto non finisce nel sorgente
 * della pagina e non c'è CORS da configurare. Se il gestionale non risponde,
 * la persona lo vede — l'errore muto è quello che ha perso i contatti finora.
 */
function rb_invia_contatto() {
	$pagina = isset( $_POST['pagina'] ) ? esc_url_raw( wp_unslash( $_POST['pagina'] ) ) : '';

	if ( ! isset( $_POST[ RB_NONCE ] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ RB_NONCE ] ) ), RB_AZIONE ) ) {
		rb_torna( $pagina, array( 'errore' => 'La pagina è rimasta aperta troppo a lungo. Riprova.' ) );
	}

	// Trappola: risposta identica a quella buona, così il bot non impara niente.
	if ( ! empty( $_POST['azienda'] ) ) {
		rb_torna( $pagina, array( 'contatto' => 'ok' ) );
	}

	$corpo = array(
		'firstName' => sanitize_text_field( wp_unslash( $_POST['nome'] ?? '' ) ),
		'lastName'  => sanitize_text_field( wp_unslash( $_POST['cognome'] ?? '' ) ),
		'phone'     => sanitize_text_field( wp_unslash( $_POST['telefono'] ?? '' ) ),
		'email'     => sanitize_email( wp_unslash( $_POST['email'] ?? '' ) ),
		'service'   => sanitize_text_field( wp_unslash( $_POST['servizio'] ?? '' ) ),
		'message'   => sanitize_textarea_field( wp_unslash( $_POST['messaggio'] ?? '' ) ),
		'privacy'   => ! empty( $_POST['privacy'] ),
		'marketing' => ! empty( $_POST['marketing'] ),
		'source'    => 'sito',
		'page'      => $pagina,
	);

	$intestazioni = array( 'Content-Type' => 'application/json' );
	if ( defined( 'REVOBEAUTY_LEAD_SECRET' ) && REVOBEAUTY_LEAD_SECRET ) {
		$intestazioni['x-lead-secret'] = REVOBEAUTY_LEAD_SECRET;
	}

	$risposta = wp_remote_post(
		rb_erp_base() . '/api/lead',
		array(
			'timeout' => 15,
			'headers' => $intestazioni,
			'body'    => wp_json_encode( $corpo ),
		)
	);

	if ( is_wp_error( $risposta ) ) {
		error_log( '[revobeauty-due] gestionale irraggiungibile: ' . $risposta->get_error_message() );
		rb_torna( $pagina, array( 'errore' => 'Non siamo riusciti a inviare la richiesta. Riprova fra poco, o scrivici su WhatsApp.' ) );
	}

	$stato = (int) wp_remote_retrieve_response_code( $risposta );
	$dati  = json_decode( wp_remote_retrieve_body( $risposta ), true );

	if ( $stato >= 200 && $stato < 300 ) {
		rb_torna( $pagina, array( 'contatto' => 'ok' ) );
	}

	$messaggio = is_array( $dati ) && ! empty( $dati['message'] ) ? $dati['message'] : 'Controlla i dati e riprova.';
	rb_torna( $pagina, array( 'errore' => $messaggio ) );
}
add_action( 'admin_post_nopriv_' . RB_AZIONE, 'rb_invia_contatto' );
add_action( 'admin_post_' . RB_AZIONE, 'rb_invia_contatto' );
