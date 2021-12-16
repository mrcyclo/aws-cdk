#!/bin/bash
sudo -i
amazon-linux-extras enable php7.4 epel && yum clean metadata
yum install -y unzip curl httpd php php-common php-pgsql php-curl php-gd php-mbstring php-xmlrpc php-intl php-zlib php-bcmath php-xml
echo "
<VirtualHost *:80>
	DocumentRoot /var/www/html/public
	<Directory /var/www/html/public>
		Order allow,deny
		Allow from all
		AllowOverride all
	</Directory>
</VirtualHost>
" | tee /etc/httpd/conf.d/web.conf
cd /var/www/html
export COMPOSER_HOME="/var/composer"
curl -sS https://getcomposer.org/installer | php -- --install-dir=/bin --filename=composer
composer create-project laravel/laravel .
chown -R ec2-user:apache /var/www/html
chmod 2775 /var/www/html
chown -R :apache storage
chown -R :apache bootstrap/cache
chgrp -R apache storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache
systemctl start httpd
systemctl enable httpd
