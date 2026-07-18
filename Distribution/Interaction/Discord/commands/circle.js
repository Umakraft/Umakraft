const { normalizeCircleId } = require('./circle-utils');

module.exports = {
  data: {
    name: 'circle',
    description: "Displays information about a trainer's circle.",
    options: [
      {
        name: 'circle_id',
        description: 'Circle identifier or uma.moe circle URL',
        type: 'STRING',
        required: true,
      },
    ],
  },
  async execute({ interaction, services }) {
    const rawCircleId = interaction.options.getString('circle_id');
    await interaction.deferReply();

    let circleId;
    try {
      circleId = normalizeCircleId(rawCircleId);
    } catch (error) {
      return interaction.editReply({
        content: error.message,
        ephemeral: true,
      });
    }

    const request = {
      type: 'circle',
      circleId,
      userId: interaction.user.id,
      source: 'discord',
    };

    const product = await services.retriever.fetchApprovedDeliverable(request);
    if (!product) {
      return {
        content: 'Unable to retrieve the circle report. Please try again later.',
        ephemeral: true,
      };
    }

    return services.delivery.formatDiscordResponse({ interaction, product, command: 'circle' });
  },
};
