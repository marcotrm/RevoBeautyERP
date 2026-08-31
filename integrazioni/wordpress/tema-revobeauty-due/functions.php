<?php
/**
 * RevoBeauty Due — il tema del redesign.
 *
 * La regola che tiene insieme tutto: il gestionale è la fonte di verità.
 * Prezzi, durate, orari, indirizzo e telefono arrivano da erp.revobeauty.it
 * (vedi inc/erp-data.php); nel tema non ce n'è nemmeno uno scritto a mano.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'RB_DUE_VERSIONE', '2.0.0' );
define( 'RB_DUE_DIR', get_template_directory() );
define( 'RB_DUE_URI', get_template_directory_uri() );

require RB_DUE_DIR . '/inc/setup.php';
require RB_DUE_DIR . '/inc/motion.php';
require RB_DUE_DIR . '/inc/erp-data.php';
require RB_DUE_DIR . '/inc/contatti.php';
require RB_DUE_DIR . '/inc/consent.php';
require RB_DUE_DIR . '/inc/schema.php';
