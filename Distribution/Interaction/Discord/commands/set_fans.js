module.exports = {
  data: {
    name: 'set_fans',
    description: "Registers or updates the user's fan count.",
    options: [
      {
        name: 'fan_count',
        description: 'Number of fans to register',
        type: 'INTEGER',
        required: true,
      },
    ],
  },
  async execute({ interaction, services }) {
    const fanCount = interaction.options.getInteger('fan_count');
    await interaction.deferReply();

    const request = {
      type: 'set_fans',
      fanCount,
      userId: interaction.user.id,
      source: 'discord',
    };

    const product = await services.retriever.fetchApprovedDeliverable(request);
    if (!product) {
      return {
        content: 'Unable to register your fan count. Please try again later.',
        ephemeral: true,
      };
    }

    return services.delivery.formatDiscordResponse({ interaction, product, command: 'set_fans' });
  },
};
