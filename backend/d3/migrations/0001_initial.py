# Generated by Django 5.0.4 on 2024-11-24 15:14

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='fixbug_db',
            fields=[
                ('grid_100', models.CharField(max_length=100, primary_key=True, serialize=False)),
                ('h_area', models.CharField(max_length=100)),
                ('b_area', models.CharField(max_length=255)),
                ('g_area', models.CharField(max_length=100, null=True)),
                ('city', models.CharField(max_length=100)),
                ('h_a_area', models.CharField(max_length=255)),
                ('x', models.FloatField(null=True)),
                ('y', models.FloatField(null=True)),
                ('male', models.IntegerField(null=True)),
                ('female', models.IntegerField(null=True)),
                ('total_population', models.IntegerField(null=True)),
                ('kid', models.IntegerField(null=True)),
                ('old', models.IntegerField(null=True)),
                ('realkid', models.IntegerField(null=True)),
                ('element', models.IntegerField(null=True)),
                ('middle', models.IntegerField(null=True)),
                ('high', models.IntegerField(null=True)),
                ('twenty', models.IntegerField(null=True)),
                ('thirty', models.IntegerField(null=True)),
                ('fourty', models.IntegerField(null=True)),
                ('fifty', models.IntegerField(null=True)),
                ('sixty', models.IntegerField(null=True)),
                ('seventy', models.IntegerField(null=True)),
            ],
        ),
    ]