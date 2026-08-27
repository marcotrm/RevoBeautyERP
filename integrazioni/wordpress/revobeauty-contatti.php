<?php
/**
 * Plugin Name: RevoBeauty — Modulo contatti
 * Description: Il modulo di /contatti che invia davvero: salva la richiesta nel gestionale e fa partire il primo messaggio su WhatsApp.
 * Version: 1.0.0
 * Author: RevoBeauty
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ ESISTE
 *
 * Il modulo che c'era su revobeauty.it/contatti non inviava niente. Il form
 * aveva `action="#"`, un `preventDefault()` in JavaScript, e il tasto che
 * diventava verde con scritto «Messaggio Inviato!» prima di svuotare i campi.
 * Nessuna email, nessun database, nessuna notifica: ogni persona che ha
 * scritto dal sito ha visto una conferma e non ha mandato niente a nessuno.
 *
 * Sotto c'era anche la riga «Oppure utilizza il modulo Contact Form 7:»
 * seguita dallo shortcode stampato a schermo — [contact-form-7 id="" title="Contatti"]
 * — perché quel plugin sul sito non è installato (e l'id era comunque vuoto).
 * Chi arrivava in fondo alla pagina leggeva del codice.
 *
 * Questo file sostituisce tutte e due le cose con un modulo solo, che posta
 * lato server al gestionale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COME SI INSTALLA
 *
 * 1. Copia questo file in `wp-content/mu-plugins/revobeauty-contatti.php`
 *    (crea la cartella `mu-plugins` se non c'è: i must-use plugin si attivano
 *    da soli e non si possono disattivare per sbaglio dalla bacheca).
 *
 *    In alternativa mettilo in `wp-content/plugins/revobeauty-contatti/` e
 *    attivalo da Plugin.
 *
 * 2. In `wp-config.php`, prima della riga «That's all, stop editing»:
 *
 *        define( 'REVOBEAUTY_ERP_URL', 'https://erp.revobeauty.it' );
 *        define( 'REVOBEAUTY_LEAD_SECRET', 'metti-qui-lo-stesso-segreto-dell-ERP' );
 *
 *    Il segreto è la variabile d'ambiente `LEAD_SECRET` del gestionale su
 *    Railway. Se là non è impostata, qui puoi ometterlo.
 *
 * 3. Nel template della pagina Contatti del tema `revobeauty` (di solito
 *    `page-contatti.php` o `template-contatti.php`), CANCELLA tutto il blocco
 *    che va da `<form action="#" ... id="contact-form">` fino al `</form>`,
 *    e cancella anche il blocco subito sotto con «Oppure utilizza il modulo
 *    Contact Form 7:» e lo shortcode. Al loro posto metti una riga sola:
 *
 *        <?php echo do_shortcode( '[revobeauty_contatti]' ); ?>
 *
 *    Nello stesso file, in fondo, togli anche il pezzo di JavaScript che
 *    intercetta l'invio (`const form = document.getElementById('contact-form')`
 *    … `e.preventDefault()`): adesso il modulo deve inviare davvero.
 *
 * 4. Prova: compila il modulo con il tuo numero. Deve arrivarti un WhatsApp e
 *    il contatto deve comparire nel gestionale, in «Contatti dal sito».
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const RB_AZIONE   = 'rb_contatto';
const RB_NONCE    = 'rb_contatto_nonce';
const RB_ERP_HOME = 'https://erp.revobeauty.it';

function rb_erp_url() {
	$url = defined( 'REVOBEAUTY_ERP_URL' ) ? REVOBEAUTY_ERP_URL : RB_ERP_HOME;
	return rtrim( $url, '/' );
}

/**
 * Il modulo.
 *
 * Le classi sono quelle del tema, identiche a prima: chi guarda la pagina non
 * deve accorgersi che è cambiato qualcosa, deve solo ricevere una risposta.
 */
function rb_modulo_contatti() {
	$campo   = 'w-full px-4 py-3 bg-[#faf8f4] border border-[#e8e2d6] rounded-lg font-montserrat text-sm text-[#1a1a1a] placeholder:text-[#6b6b6b]/50 focus:outline-none focus:border-[#b59b53] focus:ring-2 focus:ring-[rgba(181,155,83,0.15)] transition-all duration-300';
	$etichetta = 'block font-montserrat text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider mb-2';

	$esito  = isset( $_GET['contatto'] ) ? sanitize_key( wp_unslash( $_GET['contatto'] ) ) : '';
	$errore = isset( $_GET['errore'] ) ? sanitize_text_field( wp_unslash( $_GET['errore'] ) ) : '';

	ob_start();

	if ( 'ok' === $esito ) : ?>
		<div class="rounded-2xl bg-[#f5f0e8] border border-[#e8e2d6] p-8 text-center">
			<p class="font-cormorant text-2xl font-semibold text-[#1a1a1a] mb-2">Ricevuto, grazie.</p>
			<p class="font-montserrat text-sm text-[#6b6b6b] leading-relaxed">
				Ti scriviamo su WhatsApp al numero che ci hai lasciato: da lì fissiamo l'appuntamento
				senza che tu debba richiamare.
			</p>
		</div>
		<script>
		/* Conversione: il sito ha già il tag Google e il Pixel, e questo è
		   l'unico punto della pagina in cui si sa che il modulo è arrivato
		   davvero al gestionale. Prima non c'era niente da misurare, perché
		   non arrivava niente. */
		(function () {
			try { if (typeof gtag === 'function') { gtag('event', 'generate_lead', { form: 'contatti' }); } } catch (e) {}
			try { if (typeof fbq === 'function') { fbq('track', 'Lead'); } } catch (e) {}
		})();
		</script>
	<?php else :
		if ( $errore ) : ?>
			<div class="rounded-lg bg-[#fdf3f3] border border-[#e6c9c9] px-4 py-3 mb-5">
				<p class="font-montserrat text-xs text-[#8a3b3b]"><?php echo esc_html( $errore ); ?></p>
			</div>
		<?php endif; ?>

		<form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post" class="space-y-5" id="contact-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( RB_AZIONE ); ?>" />
			<?php wp_nonce_field( RB_AZIONE, RB_NONCE ); ?>
			<input type="hidden" name="pagina" value="<?php echo esc_url( home_url( add_query_arg( array() ) ) ); ?>" />

			<?php /* Campo trappola: invisibile alle persone, irresistibile per i bot. */ ?>
			<div style="position:absolute;left:-9999px;" aria-hidden="true">
				<label for="azienda">Azienda</label>
				<input type="text" id="azienda" name="azienda" tabindex="-1" autocomplete="off" />
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="nome" class="<?php echo esc_attr( $etichetta ); ?>">Nome <span class="text-[#b59b53]">*</span></label>
					<input type="text" id="nome" name="nome" required placeholder="Il tuo nome" class="<?php echo esc_attr( $campo ); ?>" />
				</div>
				<div>
					<label for="cognome" class="<?php echo esc_attr( $etichetta ); ?>">Cognome</label>
					<input type="text" id="cognome" name="cognome" placeholder="Il tuo cognome" class="<?php echo esc_attr( $campo ); ?>" />
				</div>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<?php /*
					Il telefono qui è OBBLIGATORIO e l'email no — al contrario di
					prima. Il seguito della conversazione è su WhatsApp: senza
					numero il contatto resta una riga in un elenco che nessuno
					richiama.
				*/ ?>
				<div>
					<label for="telefono" class="<?php echo esc_attr( $etichetta ); ?>">Cellulare <span class="text-[#b59b53]">*</span></label>
					<input type="tel" id="telefono" name="telefono" required placeholder="333 123 4567" class="<?php echo esc_attr( $campo ); ?>" />
					<p class="font-montserrat text-[11px] text-[#6b6b6b] mt-1.5">Ti rispondiamo su WhatsApp a questo numero.</p>
				</div>
				<div>
					<label for="email" class="<?php echo esc_attr( $etichetta ); ?>">Email</label>
					<input type="email" id="email" name="email" placeholder="email@esempio.it" class="<?php echo esc_attr( $campo ); ?>" />
				</div>
			</div>

			<div>
				<label for="servizio" class="<?php echo esc_attr( $etichetta ); ?>">Servizio di interesse</label>
				<select id="servizio" name="servizio" class="<?php echo esc_attr( $campo ); ?> appearance-none cursor-pointer">
					<option value="">Seleziona un servizio</option>
					<?php
					$servizi = array(
						'Epilazione Laser', 'Depilazione', 'Trattamenti Corpo', 'Trattamenti Viso',
						'Massaggi', 'Unghie', 'Consulenza gratuita', 'Altro',
					);
					foreach ( $servizi as $s ) {
						printf( '<option value="%1$s">%1$s</option>', esc_attr( $s ) );
					}
					?>
				</select>
			</div>

			<div>
				<label for="messaggio" class="<?php echo esc_attr( $etichetta ); ?>">Messaggio</label>
				<textarea id="messaggio" name="messaggio" rows="4" placeholder="Dicci di cosa hai bisogno e quando ti farebbe comodo passare" class="<?php echo esc_attr( $campo ); ?> resize-none"></textarea>
			</div>

			<div class="flex items-start gap-3">
				<input type="checkbox" id="privacy" name="privacy" value="1" required class="mt-1 w-4 h-4 rounded border-[#e8e2d6] text-[#b59b53] focus:ring-[#b59b53] cursor-pointer accent-[#b59b53]" />
				<label for="privacy" class="font-montserrat text-xs text-[#6b6b6b] leading-relaxed cursor-pointer">
					Ho letto e accetto l'<a href="/privacy-policy" class="text-[#b59b53] hover:text-[#8a7639] underline">informativa sulla privacy</a>.
					I dati servono a risponderti e a fissare l'appuntamento. <span class="text-[#b59b53]">*</span>
				</label>
			</div>

			<div class="flex items-start gap-3">
				<input type="checkbox" id="marketing" name="marketing" value="1" class="mt-1 w-4 h-4 rounded border-[#e8e2d6] text-[#b59b53] focus:ring-[#b59b53] cursor-pointer accent-[#b59b53]" />
				<label for="marketing" class="font-montserrat text-xs text-[#6b6b6b] leading-relaxed cursor-pointer">
					Voglio ricevere anche promozioni e novità (facoltativo, si disdice quando vuoi).
				</label>
			</div>

			<button type="submit" class="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#b59b53] text-white font-montserrat text-sm font-semibold uppercase tracking-wider rounded-lg hover:bg-[#d4c08a] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_4px_24px_rgba(181,155,83,0.3)]">
				Invia richiesta
			</button>
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
 * L'invio.
 *
 * Passa dal server, non dal browser: così il segreto condiviso non finisce nel
 * sorgente della pagina e non c'è nessun CORS da configurare. Se il gestionale
 * non risponde, la persona lo vede — l'errore muto è quello che ci ha fatto
 * perdere i contatti fino a ieri.
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
		rb_erp_url() . '/api/lead',
		array(
			'timeout' => 15,
			'headers' => $intestazioni,
			'body'    => wp_json_encode( $corpo ),
		)
	);

	if ( is_wp_error( $risposta ) ) {
		error_log( '[revobeauty-contatti] gestionale irraggiungibile: ' . $risposta->get_error_message() );
		rb_torna( $pagina, array( 'errore' => 'Non siamo riusciti a inviare la richiesta. Riprova fra poco, o scrivici su WhatsApp.' ) );
	}

	$stato = (int) wp_remote_retrieve_response_code( $risposta );
	$dati  = json_decode( wp_remote_retrieve_body( $risposta ), true );

	if ( $stato >= 200 && $stato < 300 ) {
		rb_torna( $pagina, array( 'contatto' => 'ok' ) );
	}

	$messaggio = is_array( $dati ) && ! empty( $dati['message'] )
		? $dati['message']
		: 'Controlla i dati e riprova.';
	rb_torna( $pagina, array( 'errore' => $messaggio ) );
}
add_action( 'admin_post_nopriv_' . RB_AZIONE, 'rb_invia_contatto' );
add_action( 'admin_post_' . RB_AZIONE, 'rb_invia_contatto' );
