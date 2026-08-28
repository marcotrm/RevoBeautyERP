<?php
/**
 * /chi-siamo — le persone vere del centro, dal gestionale.
 */
get_header();

$staff  = rb_staff();
$centro = rb_centro();
?>

<section class="sezione testata-pagina">
	<p class="occhiello rivela">Chi siamo</p>
	<h1 class="titolone rivela">Le mani a cui ti affidi hanno un nome.</h1>
	<p class="sottotitolo rivela">RevoBeauty apre a luglio 2026 in <?php echo esc_html( $centro['indirizzo'] ?? 'via Caudina 30, a Maddaloni' ); ?>: tecnologie recenti, un metodo semplice — prima ascoltare, poi trattare — e una squadra che ci mette la faccia.</p>
</section>

<section class="sezione foto-chi-siamo rivela">
	<?php $foto = is_readable( RB_DUE_DIR . '/assets/img/chi-siamo.webp' ) ? RB_DUE_URI . '/assets/img/chi-siamo.webp' : ''; ?>
	<?php if ( $foto ) : ?>
		<picture>
			<source type="image/avif" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/chi-siamo.avif" />
			<img src="<?php echo esc_url( $foto ); ?>" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/chi-siamo-800.webp 800w, <?php echo esc_attr( $foto ); ?> 1600w" sizes="(max-width: 1120px) 100vw, 1072px" alt="Il bancone di RevoBeauty con il logo dorato retroilluminato" width="1600" height="900" loading="lazy" />
		</picture>
	<?php else : ?>
		<div class="foto-attesa" aria-hidden="true"><span>Qui la foto vera del centro</span></div>
	<?php endif; ?>
</section>

<?php if ( $staff ) : ?>
<section class="sezione">
	<h2 class="titolone rivela">Il team</h2>
	<div class="squadra-griglia">
		<?php foreach ( $staff as $persona ) :
			$categorie = array_map( 'rb_nome_categoria', (array) ( $persona['categorie'] ?? array() ) );
			$tutte     = count( $categorie ) >= 6;
			?>
			<div class="scheda-persona rivela">
				<?php if ( ! empty( $persona['avatar'] ) ) : ?>
					<img class="scheda-foto" src="<?php echo esc_url( $persona['avatar'] ); ?>" alt="<?php echo esc_attr( $persona['nome'] ?? '' ); ?>" width="280" height="320" loading="lazy" />
				<?php else : ?>
					<span class="scheda-foto scheda-foto-vuota" aria-hidden="true"><?php echo esc_html( mb_substr( (string) ( $persona['nomeBreve'] ?? '?' ), 0, 1 ) ); ?></span>
				<?php endif; ?>
				<span class="scheda-nome"><?php echo esc_html( $persona['nome'] ?? '' ); ?></span>
				<span class="scheda-ruolo"><?php echo esc_html( $tutte ? 'Estetista specializzata' : implode( ' · ', array_slice( $categorie, 0, 3 ) ) ); ?></span>
			</div>
		<?php endforeach; ?>
	</div>
</section>
<?php endif; ?>

<section class="fascia-bordeaux">
	<p class="occhiello occhiello-chiaro rivela">Il metodo</p>
	<div class="metodo rivela">
		<div class="metodo-passo"><span class="metodo-numero">1</span><span class="metodo-nome">Consulenza gratuita</span><span class="metodo-testo">Pelle, obiettivi, tempi: prima di proporti qualcosa, ti ascoltiamo.</span></div>
		<div class="metodo-passo"><span class="metodo-numero">2</span><span class="metodo-nome">Il percorso</span><span class="metodo-testo">Il trattamento giusto, con prezzi e durate chiari dal listino.</span></div>
		<div class="metodo-passo"><span class="metodo-numero">3</span><span class="metodo-nome">I risultati</span><span class="metodo-testo">Seduta dopo seduta, con controlli e follow-up — mai promesse a vuoto.</span></div>
	</div>
</section>

<?php get_template_part( 'template-parts/cta-prenota' ); ?>

<?php get_footer(); ?>
