module.exports = {
  data: {
    name: 'fan_gain',
    description: 'Generates a fan gain report for a trainer.',
    options: [
      {
        name: 'trainer_id',
        description: 'Trainer identifier',
        type: 'STRING',
        required: true,
      },
    ],
  },
  async execute({ interaction, services, logger }) {
    const trainerId = interaction.options.getString('trainer_id');
    if (!services?.retriever) {
      return { content: 'Retriever service is not configured.', ephemeral: true };
    }
    if (!services?.delivery) {
      return { content: 'Delivery service is not configured.', ephemeral: true };
    }

    await interaction.deferReply();

    const request = {
      type: 'fan_gain',
      trainerId,
      userId: interaction.user.id,
      source: 'discord',
    };

    const product = await services.retriever.fetchApprovedDeliverable(request);
    if (!product) {
      return {
        content: 'Unable to retrieve the fan gain report. Please try again later.',
        ephemeral: true,
      };
    }

    return services.delivery.formatDiscordResponse({ interaction, product, command: 'fan_gain' });
  },
};
