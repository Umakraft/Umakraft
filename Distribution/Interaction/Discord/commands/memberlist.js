'use strict';

const { normalizeCircleId } = require('./circle-utils');

/**
 * /memberlist — Lists active members of a circle.
 *
 * Follows the same services.retriever / services.delivery pattern as all other
 * commands. Data is fetched via the full pipeline (Miner → Courier → Inspector)
 * inside the Retriever; formatting is handled by Delivery.
 */
module.exports = {
  data: {
    name: 'memberlist',
    description: 'Lists active members of a circle.',
    options: [
      {
        name: 'circle_id',
        description: 'Circle identifier or uma.moe circle URL',
        type: 3,
        required: true,
      },
    ],
  },

  async execute({ interaction, services }) {
    await interaction.deferReply();

    const rawCircleId = interaction.options.getString('circle_id');

    let circleId;
    try {
      circleId = normalizeCircleId(rawCircleId);
    } catch (err) {
      return interaction.editReply({
        content: err.message,
        ephemeral: true,
      });
    }

    const request = {
      type:     'memberlist',
      circleId,
      userId:   interaction.user.id,
      source:   'discord',
    };

    const product = await services.retriever.fetchApprovedDeliverable(request);
    if (!product) {
      return {
        content:   'Unable to retrieve the member list. Please try again later.',
        ephemeral: true,
      };
    }

    return services.delivery.formatDiscordResponse({ interaction, product, command: 'memberlist' });
  },
};
