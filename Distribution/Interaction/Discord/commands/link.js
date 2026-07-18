module.exports = {
  data: {
    name: 'link',
    description: 'Links a Discord user to a Uma Musume trainer profile.',
    options: [
      {
        name: 'trainer_id',
        description: 'Trainer identifier',
        type: 'STRING',
        required: true,
      },
    ],
  },
  async execute({ interaction, services }) {
    const trainerId = interaction.options.getString('trainer_id');
    await interaction.deferReply();

    const request = {
      type: 'link',
      trainerId,
      userId: interaction.user.id,
      source: 'discord',
    };

    const product = await services.retriever.fetchApprovedDeliverable(request);
    if (!product) {
      return {
        content: 'Unable to link your account. Please try again later.',
        ephemeral: true,
      };
    }

    return services.delivery.formatDiscordResponse({ interaction, product, command: 'link' });
  },
};
